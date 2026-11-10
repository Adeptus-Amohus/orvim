use crate::storage::WorkspaceDocument;
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Action {
    operation: String,
    collection: String,
    id: Option<Value>,
    data: Option<String>,
}
pub fn registry() -> Value {
    serde_json::from_str(include_str!(
        "../../src/features/workspace/actions-schema.json"
    ))
    .expect("bundled action registry")
}
pub fn validate(changes: &Value, document: Option<&WorkspaceDocument>) -> Result<(), String> {
    let actions: Vec<Action> = serde_json::from_value(changes.clone())
        .map_err(|_| "ИИ вернул некорректную структуру команд.")?;
    if actions.len() > 100 {
        return Err("ИИ предложил слишком много изменений.".into());
    }
    let registry = registry();
    let mut contexts = vec!["Личное".to_string()];
    if let Some(doc) = document {
        for kind in ["projects", "tasks", "events"] {
            for row in doc.data[kind].as_array().ok_or("Нет коллекции.")? {
                if let Some(name) = row[if kind == "projects" {
                    "name"
                } else {
                    "context"
                }]
                .as_str()
                {
                    contexts.push(name.to_string());
                }
            }
        }
    }
    for action in &actions {
        if action.collection == "projects" && action.operation == "upsert" {
            if let Some(raw) = &action.data {
                if let Ok(data) = serde_json::from_str::<Value>(raw) {
                    if let Some(name) = data["name"].as_str() {
                        contexts.push(name.to_string());
                    }
                }
            }
        }
    }
    for action in actions {
        let fields = registry[&action.collection]
            .as_array()
            .ok_or("ИИ предложил несуществующий тип записи.")?;
        if !["upsert", "delete"].contains(&action.operation.as_str()) {
            return Err("Неподдерживаемое действие ИИ.".into());
        }
        if let Some(doc) = document {
            if let Some(id) = &action.id {
                let field = if ["sleepLogs", "stepLogs"].contains(&action.collection.as_str()) {
                    "date"
                } else {
                    "id"
                };
                if !doc.data[&action.collection]
                    .as_array()
                    .ok_or("Нет коллекции.")?
                    .iter()
                    .any(|row| &row[field] == id)
                {
                    return Err("Запись для изменения уже не существует. Обновите контекст.".into());
                }
                if action.collection == "projects"
                    && doc.data["projects"]
                        .as_array()
                        .unwrap()
                        .iter()
                        .any(|row| &row["id"] == id && row["system"] == "unassigned")
                {
                    return Err("Системный раздел задач нельзя изменить или удалить.".into());
                }
            } else if action.operation == "delete" {
                return Err("Для удаления нужен идентификатор существующей записи.".into());
            }
        }
        if action.operation == "upsert" {
            let raw = action.data.ok_or("Нет данных изменения.")?;
            if raw.len() > 100_000 {
                return Err("Изменение слишком большое.".into());
            }
            let data: Value =
                serde_json::from_str(&raw).map_err(|_| "Некорректные данные команды ИИ.")?;
            let map = data
                .as_object()
                .ok_or("Данные команды должны быть объектом.")?;
            for (field, value) in map {
                if !fields.iter().any(|name| name.as_str() == Some(field))
                    || value.is_object()
                    || value.is_array()
                {
                    return Err(format!("Недопустимое поле команды ИИ: {field}"));
                }
                let specific = &registry["_collectionConstraints"][&action.collection][field];
                let rule = if specific.is_object() {
                    specific
                } else {
                    &registry["_constraints"][field]
                };
                let valid = if value.is_null() {
                    rule["nullable"] == true
                } else {
                    match rule["type"].as_str().unwrap_or("string") {
                        "boolean" => value.is_boolean(),
                        "number" => value.as_f64().is_some_and(|n| {
                            n >= rule["min"].as_f64().unwrap_or(0.0)
                                && n <= rule["max"].as_f64().unwrap_or(f64::MAX)
                                && rule["enum"]
                                    .as_array()
                                    .is_none_or(|allowed| allowed.contains(value))
                        }),
                        "date" => value.as_str().is_some_and(|s| {
                            s.len() == 10
                                && chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d")
                                    .is_ok_and(|date| date.format("%Y-%m-%d").to_string() == s)
                        }),
                        "time" => value.as_str().is_some_and(|s| {
                            (s.is_empty() && rule["empty"] == true)
                                || (s.len() == 5
                                    && s.as_bytes()[2] == b':'
                                    && s[..2].parse::<u8>().is_ok_and(|n| n < 24)
                                    && s[3..].parse::<u8>().is_ok_and(|n| n < 60))
                        }),
                        _ => value.as_str().is_some_and(|s| {
                            s.chars().count()
                                <= rule["maxLength"].as_u64().unwrap_or(100000) as usize
                                && rule["enum"]
                                    .as_array()
                                    .is_none_or(|allowed| allowed.iter().any(|v| v == value))
                        }),
                    }
                };
                if !valid {
                    return Err(format!("Недопустимое значение поля ИИ: {field}"));
                }
            }
            if let Some(doc) = document {
                if action.collection == "archiveItems" {
                    if let Some(status) = data["status"].as_str() {
                        let existing = action.id.as_ref().and_then(|id| {
                            doc.data["archiveItems"]
                                .as_array()?
                                .iter()
                                .find(|row| &row["id"] == id)
                        });
                        let category = data["category"]
                            .as_str()
                            .or_else(|| existing.and_then(|row| row["category"].as_str()));
                        let config = doc.data["uiPreferences"]["databaseCollections"]
                            .as_array()
                            .and_then(|configs| {
                                configs.iter().find(|c| c["name"].as_str() == category)
                            });
                        let supported = config
                            .and_then(|c| c["statuses"].as_array())
                            .map(|statuses| statuses.iter().any(|s| s["id"] == status))
                            .unwrap_or_else(|| ["planned", "active", "done"].contains(&status));
                        if !supported {
                            return Err("ИИ предложил несуществующий статус коллекции.".into());
                        }
                    }
                }
            }
            if document.is_some() && ["tasks", "events"].contains(&action.collection.as_str()) {
                if let Some(context) = data["context"].as_str() {
                    if !contexts.iter().any(|name| name == context) {
                        return Err("Задача ссылается на несуществующий проект или область.".into());
                    }
                }
            }
        }
    }
    Ok(())
}
pub fn parse_answer(text: &str) -> Result<Value, String> {
    let text = text.trim().trim_start_matches('\u{feff}').trim();
    let text = if text.starts_with("```") {
        let (header, body) = text
            .split_once('\n')
            .ok_or("ИИ прислал незавершённый блок ответа.")?;
        if !["```", "```json"].contains(&header.trim().to_ascii_lowercase().as_str()) {
            return Err("Неподдерживаемый формат ответа ИИ.".into());
        }
        body.trim()
            .strip_suffix("```")
            .ok_or("ИИ прислал незавершённый блок ответа.")?
            .trim()
    } else {
        text
    };
    let mut answer: Value = serde_json::from_str(text)
        .map_err(|_| "Модель вернула некорректный JSON. Ничего не изменено.")?;
    if answer.as_object().is_none_or(|map| {
        map.keys()
            .any(|key| !["message", "changes"].contains(&key.as_str()))
    }) || !answer["message"].is_string()
    {
        return Err("Неподдерживаемый формат ответа ИИ.".into());
    }
    // Providers without a strict schema can use normal objects for records.
    // Encode them locally, then apply exactly the same field/type validation.
    if let Some(changes) = answer["changes"].as_array_mut() {
        for change in changes {
            if change["data"].is_object() {
                change["data"] = Value::String(change["data"].to_string());
            }
        }
    }
    validate(&answer["changes"], None)?;
    Ok(json!({"message":answer["message"],"changes":answer["changes"]}))
}

pub enum ReplyError {
    Incomplete,
    Empty,
    InvalidFormat,
    Refused,
    Interrupted,
}
impl ReplyError {
    pub fn can_retry(&self) -> bool {
        matches!(self, Self::Incomplete | Self::Empty | Self::InvalidFormat)
    }
    pub fn message(&self) -> String {
        let reason = match self {
            Self::Incomplete => {
                "Ответ ИИ оборвался из-за ограничения длины. Попробуйте более короткий запрос."
            }
            Self::Empty => {
                "ИИ не вернул ответ даже после повторной попытки. Повторите сообщение позже."
            }
            Self::InvalidFormat => {
                "Не удалось прочитать ответ ИИ даже после повторной попытки. Нажмите «Повторить»."
            }
            Self::Refused => "Провайдер ИИ отклонил этот запрос.",
            Self::Interrupted => "Сервис ИИ прервал подготовку ответа. Повторите сообщение позже.",
        };
        format!("{reason} Записи не изменены.")
    }
}

pub fn parse_deepseek_response(result: &Value) -> Result<Value, ReplyError> {
    let choice = &result["choices"][0];
    match choice["finish_reason"].as_str() {
        Some("length") => return Err(ReplyError::Incomplete),
        Some("content_filter") => return Err(ReplyError::Refused),
        Some("insufficient_system_resource" | "aborted") => return Err(ReplyError::Interrupted),
        Some("tool_calls") => return Err(ReplyError::InvalidFormat),
        _ => {}
    }
    let text = choice["message"]["content"]
        .as_str()
        .filter(|text| !text.trim().is_empty())
        .ok_or(ReplyError::Empty)?;
    parse_answer(text).map_err(|_| ReplyError::InvalidFormat)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn accepts_object_records_without_double_encoded_json() {
        let text = "\u{feff}```JSON\n{\"message\":\"Предлагаю записать воду\",\"changes\":[{\"operation\":\"upsert\",\"collection\":\"waterLogs\",\"id\":null,\"data\":{\"date\":\"2026-10-12\",\"ml\":200}}]}\n```";
        let answer = parse_answer(text).unwrap();
        let record: Value =
            serde_json::from_str(answer["changes"][0]["data"].as_str().unwrap()).unwrap();
        assert_eq!(record, json!({"date":"2026-10-12","ml":200}));
        assert!(parse_answer(r#"{"message":"Готово к проверке","changes":[{"operation":"upsert","collection":"waterLogs","id":null,"data":"{\"date\":\"2026-10-12\",\"ml\":200}"}]}"#).is_ok());
    }
    #[test]
    fn object_records_still_require_allowed_fields_and_types() {
        for data in [
            json!({"ml":"200"}),
            json!({"ml":-1}),
            json!({"ml":200,"sql":"DROP TABLE tasks"}),
            json!({"ml":{"value":200}}),
        ] {
            let text = json!({"message":"x","changes":[{"operation":"upsert","collection":"waterLogs","id":null,"data":data}]}).to_string();
            assert!(parse_answer(&text).is_err());
        }
        for text in [
            r#"{"message":"x","changes":["#,
            "```json\n{\"message\":\"x\",\"changes\":[]}",
            r#"{"message":"x","changes":[],"code":"x"}"#,
        ] {
            assert!(parse_answer(text).is_err());
        }
    }
    #[test]
    fn distinguishes_incomplete_empty_invalid_and_refused_replies() {
        let response =
            |reason, text| json!({"choices":[{"finish_reason":reason,"message":{"content":text}}]});
        assert!(
            parse_deepseek_response(&response("stop", r#"{"message":"x","changes":[]}"#)).is_ok()
        );
        assert!(matches!(
            parse_deepseek_response(&response("length", r#"{"message":"x","changes":[]}"#)),
            Err(ReplyError::Incomplete)
        ));
        assert!(matches!(
            parse_deepseek_response(&response("stop", "  ")),
            Err(ReplyError::Empty)
        ));
        assert!(matches!(
            parse_deepseek_response(&response("stop", "Not JSON")),
            Err(ReplyError::InvalidFormat)
        ));
        assert!(matches!(
            parse_deepseek_response(&response("content_filter", "")),
            Err(ReplyError::Refused)
        ));
        assert!(!ReplyError::Refused.can_retry());
        assert!(!ReplyError::Interrupted.can_retry());
        assert!(ReplyError::InvalidFormat.can_retry());
    }
    #[test]
    fn rejects_wrong_field_types_dates_times_and_ranges() {
        for data in [
            json!({"done":"true"}),
            json!({"time":"25:90"}),
            json!({"date":"2026-02-30"}),
            json!({"duration":0}),
            json!({"title":true}),
            json!({"tone":"invented"}),
            json!({"status":"invented"}),
        ] {
            let collection = if data.get("tone").is_some() {
                "events"
            } else {
                "tasks"
            };
            let command = json!([{"operation":"upsert","collection":collection,"id":null,"data":data.to_string()}]);
            assert!(validate(&command, None).is_err(), "{data}");
        }
    }
    #[test]
    fn rejects_invented_fields_and_commands() {
        assert!(parse_answer(r#"{"message":"x","changes":[{"operation":"sql","collection":"tasks","id":null,"data":"{}"}]}"#).is_err());
        assert!(validate(&json!([{"operation":"upsert","collection":"tasks","id":null,"data":"{\"fakeCell\":1}"}]),None).is_err());
        assert!(validate(&json!([{"operation":"upsert","collection":"projects","id":null,"data":"{\"name\":\"Поездка\",\"description\":\"\",\"tone\":\"pine\"}"}]),None).is_ok());
        assert!(parse_answer(r#"{"message":"x","changes":[],"code":"DROP TABLE tasks"}"#).is_err());
    }
}
