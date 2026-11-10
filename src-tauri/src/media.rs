use base64::Engine;
use serde_json::{json, Value};
use std::time::{Duration, Instant};

fn title_key(value: &str) -> String {
    value
        .split('(')
        .next()
        .unwrap_or(value)
        .chars()
        .flat_map(char::to_lowercase)
        .filter(|c| c.is_alphanumeric())
        .collect()
}

fn remaining(deadline: Instant) -> Result<Duration, String> {
    deadline
        .checked_duration_since(Instant::now())
        .filter(|time| !time.is_zero())
        .map(|time| time.min(Duration::from_secs(8)))
        .ok_or_else(|| "Сервис обложек отвечает слишком долго. Попробуйте ещё раз.".into())
}

fn image_url(value: &str) -> Result<reqwest::Url, String> {
    let url = reqwest::Url::parse(value).map_err(|_| "Некорректная ссылка на обложку.")?;
    let host = url.host_str().unwrap_or_default();
    if url.scheme() != "https"
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port().is_some_and(|port| port != 443)
        || ![
            "upload.wikimedia.org",
            "thumb.wikimedia.org",
            "covers.openlibrary.org",
            "image.tmdb.org",
            "images.igdb.com",
            "books.google.com",
            "books.googleusercontent.com",
        ]
        .contains(&host)
            && host != "archive.org"
            && !host.ends_with(".archive.org")
    {
        return Err("Используйте обложку Wikimedia, Open Library, TMDB, IGDB или Google Books либо поиск по названию.".into());
    }
    Ok(url)
}

async fn bytes(mut response: reqwest::Response, maximum: usize) -> Result<Vec<u8>, String> {
    if !response.status().is_success() {
        return Err("Сервис обложек не вернул изображение.".into());
    }
    if response
        .content_length()
        .is_some_and(|size| size > maximum as u64)
    {
        return Err("Файл обложки слишком большой.".into());
    }
    let mut result = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "Не удалось загрузить обложку.")?
    {
        if result.len() + chunk.len() > maximum {
            return Err("Файл обложки слишком большой.".into());
        }
        result.extend_from_slice(&chunk);
    }
    Ok(result)
}
async fn metadata(builder: reqwest::RequestBuilder, deadline: Instant) -> Result<Value, String> {
    let response = builder
        .header("User-Agent", "Orvim/0.4 (personal media catalog)")
        .timeout(remaining(deadline)?)
        .send()
        .await
        .map_err(|_| "Сервис обложек недоступен. Проверьте подключение.")?;
    serde_json::from_slice(&bytes(response, 1024 * 1024).await?)
        .map_err(|_| "Некорректный ответ каталога обложек.".into())
}
async fn load_image(
    client: &reqwest::Client,
    source: &str,
    deadline: Instant,
) -> Result<Value, String> {
    let mut url = image_url(source)?;
    for _ in 0..3 {
        let response = client
            .get(url.clone())
            .header("User-Agent", "Orvim/0.4 (personal media catalog)")
            .timeout(remaining(deadline)?)
            .send()
            .await
            .map_err(|_| "Не удалось загрузить обложку.")?;
        if response.status().is_redirection() {
            let location = response
                .headers()
                .get(reqwest::header::LOCATION)
                .and_then(|v| v.to_str().ok())
                .ok_or("Неизвестный адрес обложки.")?;
            url = image_url(
                url.join(location)
                    .map_err(|_| "Некорректный адрес обложки.")?
                    .as_str(),
            )?;
            continue;
        }
        let raw = bytes(response, 5 * 1024 * 1024).await?;
        let mime = if raw.starts_with(&[0x89, b'P', b'N', b'G', 13, 10, 26, 10]) {
            "image/png"
        } else if raw.starts_with(&[0xff, 0xd8, 0xff]) {
            "image/jpeg"
        } else if raw.len() >= 12 && &raw[..4] == b"RIFF" && &raw[8..12] == b"WEBP" {
            "image/webp"
        } else {
            return Err("Обложка должна быть изображением JPEG, PNG или WebP.".into());
        };
        return Ok(
            json!({"image":format!("data:{mime};base64,{}", base64::engine::general_purpose::STANDARD.encode(raw)),"source":url.as_str()}),
        );
    }
    Err("Слишком много перенаправлений сервиса обложек.".into())
}

pub async fn cover(client: &reqwest::Client, args: &Value) -> Result<Value, String> {
    let deadline = Instant::now() + Duration::from_secs(30);
    if let Some(source) = args["source"].as_str().filter(|s| !s.is_empty()) {
        return load_image(client, source, deadline).await;
    }
    let query = args["query"]
        .as_str()
        .map(str::trim)
        .filter(|s| !s.is_empty() && s.chars().count() <= 200)
        .ok_or("Укажите название для поиска обложки.")?;
    if args["kind"] == "book" {
        let book_deadline = Instant::now() + Duration::from_secs(16);
        if let Ok(result) = metadata(
            client.get("https://openlibrary.org/search.json").query(&[
                ("title", query),
                ("fields", "title,cover_i"),
                ("limit", "5"),
            ]),
            book_deadline,
        )
        .await
        {
            if let Some(rows) = result["docs"].as_array() {
                for row in rows.iter().take(3) {
                    if title_key(row["title"].as_str().unwrap_or_default()) != title_key(query) {
                        continue;
                    }
                    if let Some(id) = row["cover_i"].as_u64() {
                        if let Ok(mut image) = load_image(
                            client,
                            &format!(
                                "https://covers.openlibrary.org/b/id/{id}-M.jpg?default=false"
                            ),
                            book_deadline,
                        )
                        .await
                        {
                            image["title"] = row["title"].clone();
                            image["catalog"] = json!("Open Library");
                            return Ok(image);
                        }
                    }
                }
            }
        }
    }
    let kind = args["kind"].as_str().unwrap_or_default();
    let qualifier = match kind {
        "film" => " film",
        "anime" => " anime",
        "game" => " video game",
        "book" => " book",
        _ => "",
    };
    let mut english_title: Option<String> = None;
    for language in ["ru", "en"] {
        let search = if language == "en" {
            format!("{}{qualifier}", english_title.as_deref().unwrap_or(query))
        } else {
            format!(
                "{query}{}",
                match kind {
                    "film" => " фильм",
                    "anime" => " аниме",
                    "game" => " игра",
                    "book" => " книга",
                    _ => "",
                }
            )
        };
        let endpoint = format!("https://{language}.wikipedia.org/w/api.php");
        if let Ok(result) = metadata(
            client.get(endpoint).query(&[
                ("action", "query"),
                ("format", "json"),
                ("generator", "search"),
                ("gsrsearch", &search),
                ("gsrnamespace", "0"),
                ("gsrlimit", "5"),
                ("prop", "pageimages|langlinks|description"),
                ("lllang", "en"),
                ("piprop", "thumbnail"),
                ("pilicense", "any"),
                ("pithumbsize", "640"),
            ]),
            deadline,
        )
        .await
        {
            if let Some(pages) = result["query"]["pages"].as_object() {
                let mut rows = pages.values().collect::<Vec<_>>();
                rows.sort_by_key(|row| {
                    let title = row["title"].as_str().unwrap_or_default().to_lowercase();
                    let relevant = match kind {
                        "film" => title.contains("фильм") || title.contains("film"),
                        "anime" => title.contains("аниме") || title.contains("anime"),
                        "game" => title.contains("игра") || title.contains("game"),
                        _ => true,
                    };
                    (!relevant, row["index"].as_u64().unwrap_or(u64::MAX))
                });
                for row in rows.into_iter().take(3) {
                    let title = row["title"].as_str().unwrap_or_default().to_lowercase();
                    let description = row["description"]
                        .as_str()
                        .unwrap_or_default()
                        .to_lowercase();
                    if kind == "book" {
                        let translated = row["langlinks"]
                            .as_array()
                            .and_then(|links| links.first())
                            .and_then(|link| link["*"].as_str())
                            .unwrap_or_default();
                        let expected = if language == "en" {
                            english_title.as_deref().unwrap_or(query)
                        } else {
                            query
                        };
                        if title_key(&title) != title_key(expected)
                            && title_key(translated) != title_key(expected)
                        {
                            continue;
                        }
                    }
                    if kind == "book"
                        && !description.is_empty()
                        && ![
                            "novel",
                            "book",
                            "роман",
                            "книг",
                            "повест",
                            "поэм",
                            "сборник",
                            "литератур",
                            "short story",
                            "biograph",
                        ]
                        .iter()
                        .any(|word| description.contains(word))
                    {
                        continue;
                    }
                    if kind == "book"
                        && [
                            "film",
                            "фильм",
                            "franchise",
                            "франшиза",
                            "телесериал",
                            "television",
                        ]
                        .iter()
                        .any(|word| description.contains(word))
                    {
                        continue;
                    }

                    if kind == "film"
                        && (title.contains("роман")
                            || title.contains("novel")
                            || title.contains("актёр")
                            || title.contains("actor")
                            || title.contains("music of")
                            || title.contains("саундтрек")
                            || title.contains("франшиза")
                            || title.contains("franchise"))
                    {
                        continue;
                    }
                    if kind == "book"
                        && (title.contains("фильм")
                            || title.contains("film")
                            || title.contains("music of"))
                    {
                        continue;
                    }
                    if language == "ru" && english_title.is_none() {
                        english_title = row["langlinks"]
                            .as_array()
                            .and_then(|links| links.first())
                            .and_then(|link| link["*"].as_str())
                            .map(str::to_owned);
                    }
                    if let Some(source) = row["thumbnail"]["source"].as_str() {
                        if let Ok(mut image) = load_image(client, source, deadline).await {
                            image["title"] = row["title"].clone();
                            image["catalog"] = json!("Wikipedia");
                            return Ok(image);
                        }
                    }
                }
            }
        }
    }
    Err("В каталогах не найден доступный постер. Попробуйте оригинальное название и год выпуска либо добавьте JPEG / PNG вручную. ИИ составляет запрос, но не управляет наличием изображений в каталоге.".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn image_hosts_and_redirects_are_bounded() {
        assert_eq!(title_key("Dune (novel)"), title_key("Dune"));
        assert_ne!(title_key("Dune Messiah"), title_key("Dune"));
        for url in [
            "http://covers.openlibrary.org/test.jpg",
            "https://127.0.0.1/test.jpg",
            "https://localhost/test.jpg",
            "https://upload.wikimedia.org.attacker.example/test.jpg",
            "https://name:secret@upload.wikimedia.org/test.jpg",
            "https://upload.wikimedia.org:8443/test.jpg",
            "file:///C:/private.png",
        ] {
            assert!(image_url(url).is_err(), "{url}");
        }
        for url in [
            "https://covers.openlibrary.org/b/id/11481354-L.jpg",
            "https://archive.org/download/covers/image.jpg",
            "https://ia800505.us.archive.org/test.jpg",
            "https://upload.wikimedia.org/wikipedia/en/a/a4/Dune_poster.jpg",
            "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/book.jpg/640px-book.jpg",
        ] {
            assert!(image_url(url).is_ok(), "{url}");
        }
    }
    #[test]
    #[ignore = "manual public catalog smoke check"]
    fn public_film_cover_download() {
        let client = reqwest::Client::builder()
            .https_only(true)
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .unwrap();
        let result = tauri::async_runtime::block_on(cover(
            &client,
            &json!({"query":"Дюна (фильм, 2021)","kind":"film"}),
        ))
        .unwrap();
        assert!(result["image"].as_str().unwrap().starts_with("data:image/"));
        println!(
            "Public movie lookup: {} / {}",
            result["title"], result["catalog"]
        );
    }
    #[test]
    #[ignore = "manual public catalog smoke check"]
    fn public_book_cover_download() {
        let client = reqwest::Client::builder()
            .https_only(true)
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .unwrap();
        let result =
            tauri::async_runtime::block_on(cover(&client, &json!({"query":"Dune", "kind":"book"})))
                .unwrap();
        assert!(result["image"].as_str().unwrap().starts_with("data:image/"));
        assert!(["Open Library", "Wikipedia"].contains(&result["catalog"].as_str().unwrap()));
        println!(
            "Book candidate: {} / {}",
            result["title"], result["catalog"]
        );
        assert!(
            ["Dune", "Dune (novel)", "Дюна (роман)"].contains(&result["title"].as_str().unwrap())
        );
        println!(
            "Catalog: {}; title: {}; source: {}; image bytes encoded: {}",
            result["catalog"],
            result["title"],
            result["source"],
            result["image"].as_str().unwrap().len()
        );
    }
}
