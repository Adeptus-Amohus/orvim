// Match the installer shortcut identity so Windows groups installed and portable
// launches consistently. Set it before any application window is created.
#[link(name = "shell32")]
unsafe extern "system" {
    fn SetCurrentProcessExplicitAppUserModelID(app_id: *const u16) -> i32;
}

pub fn initialize(app_id: &str) {
    let wide: Vec<u16> = app_id.encode_utf16().chain(std::iter::once(0)).collect();
    // The UTF-16 buffer is NUL-terminated and lives through this synchronous call.
    let result = unsafe { SetCurrentProcessExplicitAppUserModelID(wide.as_ptr()) };
    if result < 0 {
        eprintln!("Could not set Windows application identity: {result:#x}");
    }
}
