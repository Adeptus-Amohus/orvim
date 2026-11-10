use super::model::Result;
use serde_json::{json, Value};
use std::{
    collections::BTreeMap,
    net::{Ipv4Addr, UdpSocket},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    thread,
    time::{Duration, Instant},
};
const PORT: u16 = 42674;
const QUERY: &[u8] = b"lifeos-discover-v1";

pub fn interfaces() -> Vec<(Ipv4Addr, Ipv4Addr)> {
    if_addrs::get_if_addrs()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|interface| match interface.addr {
            if_addrs::IfAddr::V4(addr)
                if !addr.ip.is_loopback() && (addr.ip.is_private() || addr.ip.is_link_local()) =>
            {
                Some((addr.ip, addr.broadcast.unwrap_or(Ipv4Addr::BROADCAST)))
            }
            _ => None,
        })
        .collect()
}
pub fn addresses() -> Vec<String> {
    interfaces()
        .into_iter()
        .map(|(ip, _)| ip.to_string())
        .collect()
}
pub fn serve(id: String, name: String, stop: Arc<AtomicBool>) -> Result<()> {
    let socket = UdpSocket::bind((Ipv4Addr::UNSPECIFIED, PORT)).map_err(|_| {
        "Не удалось открыть обнаружение устройств. Проверьте, не запущен ли второй Orvim."
    })?;
    socket
        .set_read_timeout(Some(Duration::from_millis(300)))
        .map_err(|e| e.to_string())?;
    thread::spawn(move || {
        let mut buffer = [0; 1024];
        while !stop.load(Ordering::SeqCst) {
            if let Ok((n, source)) = socket.recv_from(&mut buffer) {
                if &buffer[..n] == QUERY && super::wire::private(source.ip()) {
                    let reply = json!({"service":"life-os","protocol":super::PROTOCOL,"id":id,"name":name,"port":super::wire::PORT});
                    let _ = socket.send_to(reply.to_string().as_bytes(), source);
                }
            }
        }
    });
    Ok(())
}
pub fn discover() -> Result<Value> {
    let mut sockets = vec![];
    for (ip, broadcast) in interfaces() {
        if let Ok(socket) = UdpSocket::bind((ip, 0)) {
            let _ = socket.set_broadcast(true);
            let _ = socket.set_nonblocking(true);
            let _ = socket.send_to(QUERY, (broadcast, PORT));
            let _ = socket.send_to(QUERY, (Ipv4Addr::BROADCAST, PORT));
            sockets.push(socket);
        }
    }
    if sockets.is_empty() {
        return Err("Локальная сеть не найдена. Подключите ПК кабелем или Wi-Fi и телефон к тому же роутеру.".into());
    }
    let until = Instant::now() + Duration::from_millis(1800);
    let mut found = BTreeMap::new();
    let mut buffer = [0; 2048];
    while Instant::now() < until {
        for socket in &sockets {
            if let Ok((n, source)) = socket.recv_from(&mut buffer) {
                if !super::wire::private(source.ip()) {
                    continue;
                }
                if let Ok(mut value) = serde_json::from_slice::<Value>(&buffer[..n]) {
                    if value["service"] == "life-os"
                        && value["protocol"] == super::PROTOCOL
                        && value["port"] == super::wire::PORT
                        && value["id"]
                            .as_str()
                            .is_some_and(|id| uuid::Uuid::parse_str(id).is_ok())
                    {
                        let name = value["name"]
                            .as_str()
                            .unwrap_or("Orvim")
                            .chars()
                            .take(80)
                            .collect::<String>();
                        value["name"] = json!(name);
                        value["address"] = json!(format!("{}:{}", source.ip(), super::wire::PORT));
                        found.insert(format!("{}-{}", value["id"], source.ip()), value);
                    }
                }
            }
        }
        thread::sleep(Duration::from_millis(30));
    }
    Ok(
        json!({"devices":found.values().collect::<Vec<_>>(),"message":if found.is_empty(){"Устройства не найдены. Включите подключение на ПК, разрешите Orvim в частной сети Windows и проверьте, что Wi-Fi не гостевой."}else{"Выберите свой ПК и сравните его идентификатор."}}),
    )
}
pub fn qr(id: &str, addresses: &[String], code: &str) -> Value {
    use qrcode::{render::svg, QrCode};
    let mut url = reqwest::Url::parse("lifeos://pair").unwrap();
    url.query_pairs_mut()
        .append_pair("id", id)
        .append_pair(
            "address",
            &format!(
                "{}:{}",
                addresses.first().map(String::as_str).unwrap_or(""),
                super::wire::PORT
            ),
        )
        .append_pair("code", code);
    let svg = QrCode::new(url.as_str())
        .map(|qr| qr.render::<svg::Color>().min_dimensions(200, 200).build())
        .unwrap_or_default();
    json!({"link":url.to_string(),"svg":svg})
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn actual_udp_discovery_response_and_qr_identity() {
        let stop = Arc::new(AtomicBool::new(false));
        let id = uuid::Uuid::new_v4().to_string();
        serve(id.clone(), "Тестовый ПК".into(), stop.clone()).unwrap();
        let socket = UdpSocket::bind((Ipv4Addr::LOCALHOST, 0)).unwrap();
        socket
            .set_read_timeout(Some(Duration::from_secs(2)))
            .unwrap();
        socket.send_to(QUERY, (Ipv4Addr::LOCALHOST, PORT)).unwrap();
        let mut buffer = [0; 2048];
        let (n, _) = socket.recv_from(&mut buffer).unwrap();
        let result: Value = serde_json::from_slice(&buffer[..n]).unwrap();
        assert_eq!(result["id"], id);
        assert_eq!(result["protocol"], super::super::PROTOCOL);
        let qr = qr(&id, &["192.168.1.2".into()], "12345678");
        let url = reqwest::Url::parse(qr["link"].as_str().unwrap()).unwrap();
        assert!(url
            .query_pairs()
            .any(|(key, value)| key == "id" && value == id));
        assert!(qr["svg"].as_str().unwrap().contains("<svg"));
        stop.store(true, Ordering::SeqCst);
    }
}
