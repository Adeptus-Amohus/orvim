//! Fixed service endpoints; credentials never follow a user-provided URL.
use serde_json::{json, Value};
use std::collections::BTreeSet;

pub(crate) fn notion_id(source: &str) -> Result<String, String> {
    let source = source.trim();
    let compact = source.replace('-', "");
    if compact.len() == 32 && compact.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Ok(compact);
    }
    let url = reqwest::Url::parse(source)
        .map_err(|_| "Вставьте ссылку на базу Notion или её ID.".to_owned())?;
    let host = url.host_str().unwrap_or_default();
    if url.scheme() != "https"
        || !url.username().is_empty()
        || url.password().is_some()
        || !(host == "notion.so" || host.ends_with(".notion.so") || host.ends_with(".notion.site"))
    {
        return Err("Поддерживаются ссылки notion.so / notion.site или ID источника.".into());
    }
    let tail = url
        .path_segments()
        .and_then(|mut parts| parts.rfind(|part| !part.is_empty()))
        .unwrap_or_default()
        .replace('-', "");
    let id = tail
        .get(tail.len().saturating_sub(32)..)
        .unwrap_or_default();
    if id.len() != 32 || !id.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err("В ссылке Notion не найден ID базы. Скопируйте ссылку на саму базу.".into());
    }
    Ok(id.to_owned())
}

pub(crate) async fn notion_import(
    client: &reqwest::Client,
    secret: &str,
    source: &str,
) -> Result<Value, String> {
    notion_at(client, secret, source, "https://api.notion.com/v1").await
}
async fn notion_at(
    client: &reqwest::Client,
    secret: &str,
    source: &str,
    base: &str,
) -> Result<Value, String> {
    let mut id = notion_id(source)?;
    let request = |url: String| {
        client
            .get(url)
            .bearer_auth(secret)
            .header("Notion-Version", "2025-09-03")
    };
    let response = request(format!("{base}/data_sources/{id}"))
        .send()
        .await
        .map_err(|_| "Notion недоступен. Проверьте интернет.".to_owned())?;
    if response.status() == reqwest::StatusCode::NOT_FOUND {
        let database = crate::connections::send(request(format!("{base}/databases/{id}"))).await?;
        let sources = database["data_sources"]
            .as_array()
            .ok_or("Notion не вернул источники базы. Проверьте доступ интеграции.")?;
        if sources.len() != 1 {
            return Err("В этой базе несколько источников. В Notion скопируйте ID нужного источника данных (data source), чтобы не импортировать лишнее.".into());
        }
        id = sources[0]["id"]
            .as_str()
            .ok_or("У источника Notion нет ID.")?
            .to_owned();
    } else {
        crate::connections::response_json(response).await?;
    }
    let mut rows = Vec::new();
    let mut cursor: Option<String> = None;
    let mut seen = BTreeSet::new();
    loop {
        let mut body = json!({"page_size":100});
        if let Some(cursor) = &cursor {
            body["start_cursor"] = json!(cursor);
        }
        let result = crate::connections::send(
            client
                .post(format!("{base}/data_sources/{id}/query"))
                .bearer_auth(secret)
                .header("Notion-Version", "2025-09-03")
                .json(&body),
        )
        .await?;
        rows.extend(
            result["results"]
                .as_array()
                .ok_or("Notion не вернул записи.")?
                .clone(),
        );
        if rows.len() > 10000 {
            return Err("Импорт ограничен 10 000 записей за раз.".into());
        }
        if result["has_more"] != true {
            break;
        }
        let next = result["next_cursor"]
            .as_str()
            .filter(|s| !s.is_empty())
            .ok_or("Notion вернул некорректную страницу.")?
            .to_owned();
        if !seen.insert(next.clone()) {
            return Err(
                "Notion повторяет страницу. Импорт остановлен без изменения записей.".into(),
            );
        }
        cursor = Some(next);
    }
    Ok(json!({"results":rows}))
}

pub(crate) async fn google_pages(
    client: &reqwest::Client,
    token: &str,
    url: &str,
    parameters: Vec<(&str, String)>,
) -> Result<Value, String> {
    let mut rows = Vec::new();
    let mut page: Option<String> = None;
    let mut seen = BTreeSet::new();
    loop {
        let mut query = parameters.clone();
        if let Some(ref page) = page {
            query.push(("pageToken", page.clone()));
        }
        let result =
            crate::connections::send(client.get(url).bearer_auth(token).query(&query)).await?;
        if let Some(items) = result["items"].as_array() {
            rows.extend(items.clone());
        } else if !result["items"].is_null()
            || !matches!(
                result["kind"].as_str(),
                Some("calendar#events" | "calendar#calendarList")
            )
        {
            return Err("Google Calendar не вернул список событий или календарей.".into());
        }
        if rows.len() > 10000 {
            return Err("Получено больше 10 000 записей. Выберите меньший период.".into());
        }
        let Some(next) = result["nextPageToken"].as_str().filter(|s| !s.is_empty()) else {
            break;
        };
        if !seen.insert(next.to_owned()) {
            return Err("Google Calendar повторяет страницу. Обмен остановлен.".into());
        }
        page = Some(next.to_owned());
    }
    Ok(json!({"items":rows}))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        io::{Read, Write},
        net::TcpListener,
        thread,
    };
    fn server(replies: Vec<(u16, Value)>) -> (String, thread::JoinHandle<Vec<String>>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let url = format!("http://{}", listener.local_addr().unwrap());
        let handle = thread::spawn(move || {
            let mut requests = Vec::new();
            for (status, body) in replies {
                let (mut stream, _) = listener.accept().unwrap();
                stream
                    .set_read_timeout(Some(std::time::Duration::from_secs(5)))
                    .unwrap();
                let mut bytes = Vec::new();
                let mut buffer = [0; 4096];
                loop {
                    let n = stream.read(&mut buffer).unwrap();
                    bytes.extend_from_slice(&buffer[..n]);
                    if n == 0 {
                        break;
                    }
                    if let Some(end) = bytes.windows(4).position(|s| s == b"\r\n\r\n") {
                        let header = String::from_utf8_lossy(&bytes[..end]).to_lowercase();
                        let size = header
                            .lines()
                            .find_map(|s| {
                                s.strip_prefix("content-length:")
                                    .and_then(|n| n.trim().parse::<usize>().ok())
                            })
                            .unwrap_or(0);
                        if bytes.len() >= end + 4 + size {
                            break;
                        }
                    }
                }
                requests.push(String::from_utf8(bytes).unwrap());
                let body = body.to_string();
                write!(stream,"HTTP/1.1 {status} Test\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",body.len()).unwrap();
            }
            requests
        });
        (url, handle)
    }
    #[test]
    fn notion_links_do_not_redirect_credentials() {
        let id = "1234567890abcdef1234567890abcdef";
        assert_eq!(
            notion_id(&format!("https://www.notion.so/My-table-{id}?v=ignored")).unwrap(),
            id
        );
        assert_eq!(
            notion_id("12345678-90ab-cdef-1234-567890abcdef").unwrap(),
            id
        );
        assert!(notion_id(&format!("https://evil.test/{id}")).is_err());
        assert!(notion_id("javascript:alert(1)").is_err());
        assert_eq!(
            notion_id(&format!("https://www.notion.so/{id}/")).unwrap(),
            id
        );
    }
    #[test]
    fn native_notion_resolves_database_and_reads_all_pages() {
        let (base, server) = server(vec![
            (404, json!({"message":"not found"})),
            (200, json!({"data_sources":[{"id":"source-id"}]})),
            (
                200,
                json!({"results":[{"id":"one"}],"has_more":true,"next_cursor":"next"}),
            ),
            (200, json!({"results":[{"id":"two"}],"has_more":false})),
        ]);
        let result = tauri::async_runtime::block_on(notion_at(
            &reqwest::Client::new(),
            "synthetic-test-token",
            "1234567890abcdef1234567890abcdef",
            &base,
        ))
        .unwrap();
        assert_eq!(result["results"].as_array().unwrap().len(), 2);
        let requests = server.join().unwrap();
        assert!(requests.iter().all(|r| r
            .to_lowercase()
            .contains("authorization: bearer synthetic-test-token")));
        assert!(requests[3].contains("\"start_cursor\":\"next\""));
        assert!(requests[2].starts_with("POST /data_sources/source-id/query"));
    }
    #[test]
    fn native_calendar_reads_pages_and_rejects_repeated_cursor() {
        let (base, server) = server(vec![
            (200, json!({"items":[{"id":"one"}],"nextPageToken":"next"})),
            (200, json!({"items":[{"id":"two"}],"nextPageToken":"next"})),
        ]);
        let result = tauri::async_runtime::block_on(google_pages(
            &reqwest::Client::new(),
            "synthetic",
            &base,
            vec![("singleEvents", "true".into())],
        ));
        assert!(result.unwrap_err().contains("повторяет"));
        let requests = server.join().unwrap();
        assert!(requests[1].contains("pageToken=next"));
    }
    #[test]
    fn native_calendar_combines_pages_and_accepts_empty_calendar() {
        let (base, server) = server(vec![
            (
                200,
                json!({"kind":"calendar#events","items":[{"id":"one"}],"nextPageToken":"two"}),
            ),
            (
                200,
                json!({"kind":"calendar#events","items":[{"id":"two"}]}),
            ),
        ]);
        let result = tauri::async_runtime::block_on(google_pages(
            &reqwest::Client::new(),
            "synthetic",
            &base,
            vec![],
        ))
        .unwrap();
        assert_eq!(result["items"].as_array().unwrap().len(), 2);
        server.join().unwrap();
        let (base, server) = self::server(vec![(200, json!({"kind":"calendar#events"}))]);
        let result = tauri::async_runtime::block_on(google_pages(
            &reqwest::Client::new(),
            "synthetic",
            &base,
            vec![],
        ))
        .unwrap();
        assert!(result["items"].as_array().unwrap().is_empty());
        server.join().unwrap();
    }
    #[test]
    fn notion_unauthorized_is_not_reported_as_success() {
        let (base, server) = server(vec![(401, json!({"message":"Invalid synthetic token"}))]);
        let result = tauri::async_runtime::block_on(notion_at(
            &reqwest::Client::new(),
            "synthetic",
            "1234567890abcdef1234567890abcdef",
            &base,
        ));
        assert!(result.is_err());
        assert_eq!(server.join().unwrap().len(), 1);
    }
    #[test]
    fn notion_direct_source_pages_and_version_header() {
        let (base, server) = server(vec![
            (200, json!({"object":"data_source"})),
            (
                200,
                json!({"results":[{"id":"one"}],"has_more":true,"next_cursor":"page2"}),
            ),
            (200, json!({"results":[],"has_more":false})),
        ]);
        let result = tauri::async_runtime::block_on(notion_at(
            &reqwest::Client::new(),
            "synthetic",
            "1234567890abcdef1234567890abcdef",
            &base,
        ))
        .unwrap();
        assert_eq!(result["results"].as_array().unwrap().len(), 1);
        let requests = server.join().unwrap();
        assert!(requests
            .iter()
            .all(|r| r.to_lowercase().contains("notion-version: 2025-09-03")));
        assert!(requests[2].contains("\"start_cursor\":\"page2\""));
    }
    #[test]
    fn notion_repeated_cursor_and_ambiguous_database_are_errors() {
        let (base, server) = server(vec![
            (200, json!({})),
            (
                200,
                json!({"results":[],"has_more":true,"next_cursor":"same"}),
            ),
            (
                200,
                json!({"results":[],"has_more":true,"next_cursor":"same"}),
            ),
        ]);
        let result = tauri::async_runtime::block_on(notion_at(
            &reqwest::Client::new(),
            "synthetic",
            "1234567890abcdef1234567890abcdef",
            &base,
        ));
        assert!(result.unwrap_err().contains("повторяет"));
        server.join().unwrap();
        let (base, server) = self::server(vec![
            (404, json!({})),
            (200, json!({"data_sources":[{"id":"one"},{"id":"two"}]})),
        ]);
        let result = tauri::async_runtime::block_on(notion_at(
            &reqwest::Client::new(),
            "synthetic",
            "1234567890abcdef1234567890abcdef",
            &base,
        ));
        assert!(result.unwrap_err().contains("несколько"));
        assert_eq!(server.join().unwrap().len(), 2);
    }
}
