use super::model::{Hub, Patch, Result};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use chacha20poly1305::{
    aead::{Aead, AeadCore, KeyInit, OsRng, Payload},
    XChaCha20Poly1305, XNonce,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use spake2::{Ed25519Group, Identity, Password, Spake2};
use std::{
    io::{Read, Write},
    net::{IpAddr, SocketAddr, TcpStream},
    time::Duration,
};
use uuid::Uuid;

pub const PORT: u16 = 42673;
pub const MAX_FRAME: usize = 140 * 1024 * 1024;
#[derive(Clone, Serialize, Deserialize)]
pub struct Peer {
    pub id: String,
    pub name: String,
    pub key: String,
    #[serde(default)]
    pub last_seen: i64,
}
#[derive(Clone, Serialize, Deserialize)]
pub struct Profile {
    pub address: String,
    pub peer: Peer,
    pub host_id: String,
    pub host_name: String,
}
#[derive(Serialize, Deserialize)]
pub struct Request {
    pub challenge: String,
    pub device: String,
    pub generation: u64,
    pub patches: Vec<Patch>,
    #[serde(default)]
    pub resolve: Option<(String, bool)>,
}
#[derive(Serialize, Deserialize)]
pub struct Response {
    pub challenge: String,
    pub hub: Option<Hub>,
    pub generation: u64,
    pub conflicts: usize,
}
pub fn private(ip: IpAddr) -> bool {
    matches!(ip, IpAddr::V4(v) if v.is_private() || v.is_loopback() || v.is_link_local())
}
pub fn address(raw: &str) -> Result<SocketAddr> {
    let text = raw.trim();
    let text = if text.contains(':') {
        text.to_owned()
    } else {
        format!("{text}:{PORT}")
    };
    let address: SocketAddr = text
        .parse()
        .map_err(|_| "Введите локальный IPv4 адрес ПК, например 192.168.1.12:42673.")?;
    if !private(address.ip()) || address.port() == 0 {
        return Err("Доступны только адреса локальной сети.".into());
    }
    Ok(address)
}
pub fn connect(address: SocketAddr) -> Result<TcpStream> {
    let stream = TcpStream::connect_timeout(&address, Duration::from_secs(5)).map_err(|_| "ПК недоступен. Подключите оба устройства к одной сети и разрешите Orvim в частной сети Windows.")?;
    timeouts(&stream)?;
    Ok(stream)
}
pub fn timeouts(stream: &TcpStream) -> Result<()> {
    stream.set_nonblocking(false).map_err(|e| e.to_string())?;
    stream
        .set_read_timeout(Some(Duration::from_secs(25)))
        .map_err(|e| e.to_string())?;
    stream
        .set_write_timeout(Some(Duration::from_secs(25)))
        .map_err(|e| e.to_string())?;
    stream.set_nodelay(true).map_err(|e| e.to_string())?;
    Ok(())
}
pub fn write(stream: &mut TcpStream, value: &impl Serialize) -> Result<()> {
    let body = serde_json::to_vec(value).map_err(|e| e.to_string())?;
    if body.len() > MAX_FRAME {
        return Err("Данные превышают размер одного обмена.".into());
    }
    stream
        .write_all(&(body.len() as u32).to_be_bytes())
        .and_then(|_| stream.write_all(&body))
        .map_err(|_| "Соединение прервано. Изменения сохранены локально.".into())
}
pub fn read(stream: &mut TcpStream) -> Result<Value> {
    read_limit(stream, MAX_FRAME)
}
pub fn read_small(stream: &mut TcpStream) -> Result<Value> {
    read_limit(stream, 8192)
}
fn read_limit(stream: &mut TcpStream, limit: usize) -> Result<Value> {
    let mut prefix = [0u8; 4];
    stream
        .read_exact(&mut prefix)
        .map_err(|_| "Не удалось получить ответ устройства.".to_string())?;
    let length = u32::from_be_bytes(prefix) as usize;
    if length == 0 || length > limit {
        return Err("Некорректный размер сообщения.".into());
    }
    let mut bytes = vec![0u8; length];
    stream
        .read_exact(&mut bytes)
        .map_err(|_| "Обмен прерван. Повторите синхронизацию.".to_string())?;
    let value: Value =
        serde_json::from_slice(&bytes).map_err(|_| "Некорректный ответ устройства.")?;
    if let Some(error) = value.get("error").and_then(Value::as_str) {
        return Err(error.chars().take(400).collect());
    }
    Ok(value)
}
fn cipher(key: &str) -> Result<XChaCha20Poly1305> {
    let raw = B64.decode(key).map_err(|_| "Повреждён ключ сопряжения.")?;
    XChaCha20Poly1305::new_from_slice(&raw).map_err(|_| "Повреждён ключ сопряжения.".into())
}
pub fn seal(key: &str, context: &str, value: &impl Serialize) -> Result<Value> {
    let cipher = cipher(key)?;
    let nonce = XChaCha20Poly1305::generate_nonce(&mut OsRng);
    let data = serde_json::to_vec(value).map_err(|e| e.to_string())?;
    let encrypted = cipher
        .encrypt(
            &nonce,
            Payload {
                msg: &data,
                aad: context.as_bytes(),
            },
        )
        .map_err(|_| "Не удалось зашифровать обмен.")?;
    Ok(json!({"nonce":B64.encode(nonce),"ciphertext":B64.encode(encrypted)}))
}
pub fn unseal<T: serde::de::DeserializeOwned>(
    key: &str,
    context: &str,
    envelope: Value,
) -> Result<T> {
    let nonce = B64
        .decode(envelope["nonce"].as_str().ok_or("Нет nonce.")?)
        .map_err(|_| "Некорректный nonce.")?;
    if nonce.len() != 24 {
        return Err("Некорректный nonce.".into());
    }
    let body = B64
        .decode(
            envelope["ciphertext"]
                .as_str()
                .ok_or("Нет зашифрованных данных.")?,
        )
        .map_err(|_| "Некорректные данные.")?;
    let clear = cipher(key)?
        .decrypt(
            XNonce::from_slice(&nonce),
            Payload {
                msg: &body,
                aad: context.as_bytes(),
            },
        )
        .map_err(|_| "Код неверен или подлинность устройства не подтверждена.")?;
    serde_json::from_slice(&clear).map_err(|_| "Некорректное зашифрованное сообщение.".into())
}
fn derived(raw: &[u8]) -> String {
    let mut hash = Sha256::new();
    hash.update(b"Life OS LAN v1 session");
    hash.update(raw);
    B64.encode(hash.finalize())
}
pub fn pair_client(address: SocketAddr, code: &str, name: &str) -> Result<Profile> {
    if code.len() != 8 || !code.bytes().all(|b| b.is_ascii_digit()) {
        return Err("Код состоит из восьми цифр.".into());
    }
    let mut stream = connect(address)?;
    let (state, message) = Spake2::<Ed25519Group>::start_a(
        &Password::new(code.as_bytes()),
        &Identity::new(b"LifeOS LAN client v1"),
        &Identity::new(b"LifeOS LAN host v1"),
    );
    write(
        &mut stream,
        &json!({"protocol":super::PROTOCOL,"operation":"pair","message":B64.encode(message)}),
    )?;
    let reply = read_small(&mut stream)?;
    let inbound = B64
        .decode(reply["message"].as_str().ok_or("Нет ответа сопряжения.")?)
        .map_err(|_| "Некорректный ответ сопряжения.")?;
    let key = derived(
        &state
            .finish(&inbound)
            .map_err(|_| "Не удалось подтвердить код.")?,
    );
    let challenge = reply["challenge"]
        .as_str()
        .ok_or("Нет подтверждения сопряжения.")?;
    let name: String = name.chars().take(60).collect();
    write(
        &mut stream,
        &seal(
            &key,
            "LifeOS LAN pair client v1",
            &json!({"challenge":challenge,"name":name}),
        )?,
    )?;
    let confirmation: Value = unseal(&key, "LifeOS LAN pair host v1", read_small(&mut stream)?)?;
    if confirmation["challenge"] != challenge {
        return Err("Неверное подтверждение сопряжения.".into());
    }
    Ok(Profile {
        address: address.to_string(),
        peer: Peer {
            id: confirmation["peer"]
                .as_str()
                .ok_or("Нет устройства.")?
                .into(),
            name,
            key,
            last_seen: 0,
        },
        host_id: confirmation["hostId"].as_str().ok_or("Нет ПК.")?.into(),
        host_name: confirmation["hostName"].as_str().unwrap_or("ПК").into(),
    })
}
pub fn pair_host(stream: &mut TcpStream, hello: &Value, code: &str) -> Result<(Peer, String)> {
    let inbound = B64
        .decode(
            hello["message"]
                .as_str()
                .ok_or("Нет сообщения сопряжения.")?,
        )
        .map_err(|_| "Некорректное сопряжение.")?;
    if inbound.len() != 33 {
        return Err("Некорректное сопряжение.".into());
    }
    let (state, message) = Spake2::<Ed25519Group>::start_b(
        &Password::new(code.as_bytes()),
        &Identity::new(b"LifeOS LAN client v1"),
        &Identity::new(b"LifeOS LAN host v1"),
    );
    let key = derived(
        &state
            .finish(&inbound)
            .map_err(|_| "Некорректное сопряжение.")?,
    );
    let challenge = Uuid::new_v4().to_string();
    write(
        stream,
        &json!({"message":B64.encode(message),"challenge":challenge}),
    )?;
    let confirmation: Value = unseal(&key, "LifeOS LAN pair client v1", read_small(stream)?)?;
    if confirmation["challenge"] != challenge {
        return Err("Неверное подтверждение сопряжения.".into());
    }
    let name = confirmation["name"]
        .as_str()
        .unwrap_or("Телефон")
        .chars()
        .take(60)
        .collect();
    Ok((
        Peer {
            id: Uuid::new_v4().to_string(),
            name,
            key,
            last_seen: 0,
        },
        challenge,
    ))
}
pub fn confirm_pair(
    stream: &mut TcpStream,
    peer: &Peer,
    challenge: &str,
    host_id: &str,
    host_name: &str,
) -> Result<()> {
    write(
        stream,
        &seal(
            &peer.key,
            "LifeOS LAN pair host v1",
            &json!({"challenge":challenge,"peer":peer.id,"hostId":host_id,"hostName":host_name}),
        )?,
    )
}
pub fn exchange(
    profile: &Profile,
    device: &str,
    generation: u64,
    patches: Vec<Patch>,
    resolve: Option<(String, bool)>,
) -> Result<Response> {
    let mut stream = connect(address(&profile.address)?)?;
    write(
        &mut stream,
        &json!({"protocol":super::PROTOCOL,"operation":"sync","peer":profile.peer.id}),
    )?;
    let hello = read_small(&mut stream)?;
    let challenge = hello["challenge"]
        .as_str()
        .ok_or("Нет подтверждения устройства.")?
        .to_owned();
    let request = Request {
        challenge: challenge.clone(),
        device: device.into(),
        generation,
        patches,
        resolve,
    };
    let aad = format!("LifeOS LAN request v1 {}", profile.peer.id);
    write(&mut stream, &seal(&profile.peer.key, &aad, &request)?)?;
    let result: Response = unseal(
        &profile.peer.key,
        &format!("LifeOS LAN response v1 {}", profile.peer.id),
        read(&mut stream)?,
    )?;
    if result.challenge != challenge {
        return Err("Устаревший ответ устройства.".into());
    }
    Ok(result)
}
