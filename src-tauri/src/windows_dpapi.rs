//! Same CurrentUser DPAPI format as .NET ProtectedData, without starting PowerShell.
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use std::{ffi::c_void, ptr};
use zeroize::{Zeroize, Zeroizing};

#[repr(C)]
struct Blob {
    len: u32,
    data: *mut u8,
}

#[link(name = "crypt32")]
unsafe extern "system" {
    fn CryptProtectData(
        input: *const Blob,
        description: *const u16,
        entropy: *const Blob,
        reserved: *mut c_void,
        prompt: *mut c_void,
        flags: u32,
        output: *mut Blob,
    ) -> i32;
    fn CryptUnprotectData(
        input: *const Blob,
        description: *mut *mut u16,
        entropy: *const Blob,
        reserved: *mut c_void,
        prompt: *mut c_void,
        flags: u32,
        output: *mut Blob,
    ) -> i32;
}
#[link(name = "kernel32")]
unsafe extern "system" {
    fn LocalFree(memory: *mut c_void) -> *mut c_void;
}

impl Drop for Blob {
    fn drop(&mut self) {
        if !self.data.is_null() {
            // DPAPI owns this allocation; erase decrypted bytes before releasing it.
            unsafe {
                std::slice::from_raw_parts_mut(self.data, self.len as usize).zeroize();
                LocalFree(self.data.cast());
            }
        }
    }
}

fn crypt(bytes: &[u8], protect: bool) -> Result<Zeroizing<Vec<u8>>, String> {
    // The input is borrowed, so only the output blob uses the owning Drop impl.
    let input = std::mem::ManuallyDrop::new(Blob {
        len: u32::try_from(bytes.len()).map_err(|_| "Ключ слишком длинный.")?,
        data: bytes.as_ptr().cast_mut(),
    });
    let mut output = Blob {
        len: 0,
        data: ptr::null_mut(),
    };
    // UI_FORBIDDEN only; deliberately do not set LOCAL_MACHINE. No extra entropy,
    // matching the existing .NET ProtectedData(..., null, CurrentUser) files.
    let success = unsafe {
        if protect {
            CryptProtectData(
                &*input,
                ptr::null(),
                ptr::null(),
                ptr::null_mut(),
                ptr::null_mut(),
                1,
                &mut output,
            )
        } else {
            CryptUnprotectData(
                &*input,
                ptr::null_mut(),
                ptr::null(),
                ptr::null_mut(),
                ptr::null_mut(),
                1,
                &mut output,
            )
        }
    };
    if success == 0 {
        return Err("Не удалось открыть защищённый ключ Windows.".into());
    }
    let value = if output.len == 0 {
        Vec::new()
    } else {
        // Successful DPAPI call supplies output.len bytes until LocalFree.
        unsafe { std::slice::from_raw_parts(output.data, output.len as usize) }.to_vec()
    };
    Ok(Zeroizing::new(value))
}

pub fn protect(value: &str) -> Result<String, String> {
    Ok(B64.encode(&*crypt(value.as_bytes(), true)?))
}

pub fn unprotect(encoded: &str) -> Result<String, String> {
    let encrypted = B64
        .decode(encoded.trim())
        .map_err(|_| "Повреждён защищённый ключ Windows.")?;
    let decrypted = crypt(&encrypted, false)?;
    std::str::from_utf8(&decrypted)
        .map(str::to_owned)
        .map_err(|_| "Повреждён защищённый ключ Windows.".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn compatible_with_existing_dotnet_credentials() {
        for value in ["synthetic storage key", "Керамика · Orvim 🔑", ""] {
            let legacy = crate::platform::powershell(
                include_str!("windows.ps1"),
                &json!({"operation":"credential", "mode":"protect", "value":value}),
            )
            .unwrap();
            assert_eq!(unprotect(legacy["value"].as_str().unwrap()).unwrap(), value);
            let native = protect(value).unwrap();
            let legacy = crate::platform::powershell(
                include_str!("windows.ps1"),
                &json!({"operation":"credential", "mode":"unprotect", "value":native}),
            )
            .unwrap();
            assert_eq!(legacy["value"].as_str().unwrap(), value);
        }
    }

    #[test]
    fn rejects_damaged_credentials() {
        assert!(unprotect("invalid base64!").is_err());
        assert!(unprotect(&B64.encode(b"invalid DPAPI blob")).is_err());
    }
}
