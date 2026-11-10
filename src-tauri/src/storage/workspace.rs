use super::Repository;
use crate::domain::{date, now, Error, Result};
use chrono::{DateTime, Local};
use rusqlite::{params, OptionalExtension, TransactionBehavior};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::collections::{HashMap, HashSet};

pub const COLLECTIONS: [&str; 20] = [
    "tasks",
    "events",
    "checkins",
    "projects",
    "sleepLogs",
    "foodLogs",
    "workouts",
    "recoveryLogs",
    "waterLogs",
    "trainingGoals",
    "archiveItems",
    "savedMeals",
    "taskTemplates",
    "thoughts",
    "financeLogs",
    "exercises",
    "stepLogs",
    "weightLogs",
    "illnessLogs",
    "nutrientLogs",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceDocument {
    pub revision: u64,
    pub data: Value,
    pub covers: Vec<(i64, String)>,
}

fn invalid(message: &str) -> Error {
    Error::Validation(message.to_owned())
}
fn text(value: &Value, field: &str, required: bool) -> Result<()> {
    match value.get(field) {
        Some(Value::String(text))
            if text.len() <= 100_000 && (!required || !text.trim().is_empty()) =>
        {
            Ok(())
        }
        None | Some(Value::Null) if !required => Ok(()),
        _ => Err(invalid(&format!("Некорректный текст: {field}"))),
    }
}
fn number(value: &Value, field: &str, min: f64, max: f64, optional: bool) -> Result<()> {
    match value.get(field) {
        Some(Value::Number(number))
            if number
                .as_f64()
                .is_some_and(|n| n.is_finite() && n >= min && n <= max) =>
        {
            Ok(())
        }
        None | Some(Value::Null) if optional => Ok(()),
        _ => Err(invalid(&format!("Некорректное число: {field}"))),
    }
}
fn validate_rest_settings(value: &Value) -> Result<()> {
    if value.get("restSeconds").is_some() {
        number(value, "restSeconds", 5.0, 300.0, false)?;
        if value["restSeconds"]
            .as_f64()
            .is_some_and(|n| n.fract() != 0.0)
        {
            return Err(invalid("Длительность отдыха должна быть целой."));
        }
    }
    for field in ["restAutomatic", "restSound"] {
        if value.get(field).is_some_and(|v| !v.is_boolean()) {
            return Err(invalid("Некорректные настройки отдыха занятия."));
        }
    }
    Ok(())
}
fn day(value: &Value, field: &str) -> Result<()> {
    let day = value
        .get(field)
        .and_then(Value::as_str)
        .ok_or_else(|| invalid("Не указана дата."))?;
    date(day).map(|_| ())
}
fn minutes(value: &Value, field: &str) -> Result<u32> {
    let time = value
        .get(field)
        .and_then(Value::as_str)
        .ok_or_else(|| invalid("Не указано время."))?;
    let bytes = time.as_bytes();
    if bytes.len() != 5
        || bytes[2] != b':'
        || ![bytes[0], bytes[1], bytes[3], bytes[4]]
            .iter()
            .all(u8::is_ascii_digit)
    {
        return Err(invalid("Некорректное время."));
    }
    let hour = (bytes[0] - b'0') as u32 * 10 + (bytes[1] - b'0') as u32;
    let minute = (bytes[3] - b'0') as u32 * 10 + (bytes[4] - b'0') as u32;
    if hour > 23 || minute > 59 {
        return Err(invalid("Некорректное время."));
    }
    Ok(hour * 60 + minute)
}
fn safe_keys(value: &Value) -> bool {
    match value {
        Value::Object(map) => map.iter().all(|(key, value)| {
            !["__proto__", "prototype", "constructor"].contains(&key.as_str()) && safe_keys(value)
        }),
        Value::Array(values) => values.iter().all(safe_keys),
        _ => true,
    }
}
fn validate_life_preferences(state: &Value) -> Result<()> {
    let Some(prefs) = state.get("lifePreferences") else {
        return Ok(());
    };
    if !prefs.is_object() {
        return Err(invalid("Некорректные настройки учёта жизни."));
    }
    for key in ["weight", "illness"] {
        if prefs.get(key).is_some_and(|v| !v.is_boolean()) {
            return Err(invalid("Некорректный переключатель учёта."));
        }
    }
    if let Some(day) = prefs.get("personalDay") {
        if !day.is_object() || !day["enabled"].is_boolean() {
            return Err(invalid("Некорректное начало личного дня."));
        }
        minutes(day, "start")?;
    }
    if let Some(nutrition) = prefs.get("nutrition") {
        if !nutrition.is_object()
            || ["water", "calories", "macros", "micronutrients"]
                .iter()
                .any(|key| !nutrition[key].is_boolean())
        {
            return Err(invalid("Некорректный учёт питания."));
        }
    }
    if let Some(targets) = prefs.get("nutrientTargets") {
        let rows = targets
            .as_array()
            .filter(|r| r.len() <= 100)
            .ok_or_else(|| invalid("Некорректные цели веществ."))?;
        let mut keys = HashSet::new();
        for row in rows {
            text(row, "key", true)?;
            text(row, "name", true)?;
            number(row, "target", 0.001, 1e9, true)?;
            if !keys.insert(row["key"].as_str())
                || row["key"].as_str().is_some_and(|v| v.len() > 200)
                || row["name"]
                    .as_str()
                    .is_some_and(|v| v.chars().count() > 100)
                || !matches!(row["unit"].as_str(), Some("мг" | "мкг" | "МЕ" | "г"))
            {
                return Err(invalid("Некорректное вещество или единица."));
            }
        }
    }
    Ok(())
}
pub fn validate_workspace(document: &WorkspaceDocument) -> Result<()> {
    let state = &document.data;
    let version = state.get("version").and_then(Value::as_u64);
    if !matches!(version, Some(30..=32)) || !safe_keys(state) {
        return Err(invalid("Неподдерживаемый формат рабочего пространства."));
    }
    validate_life_preferences(state)?;
    if serde_json::to_vec(document)
        .map_err(|_| invalid("Невозможно сохранить данные."))?
        .len()
        > 100 * 1024 * 1024
    {
        return Err(invalid("Рабочее пространство превышает 100 МБ. Сохраните резервную копию и уменьшите изображения."));
    }
    for collection in COLLECTIONS {
        if version != Some(32)
            && ["weightLogs", "illnessLogs", "nutrientLogs"].contains(&collection)
            && state.get(collection).is_none()
        {
            continue;
        }
        if collection == "stepLogs" && version == Some(30) && state.get(collection).is_none() {
            continue;
        }
        let values = state
            .get(collection)
            .and_then(Value::as_array)
            .ok_or_else(|| invalid(&format!("Нет коллекции {collection}")))?;
        if values.len() > 100_000 {
            return Err(invalid("Слишком много записей в одной коллекции."));
        }
        let mut keys = HashSet::new();
        for item in values {
            if !item.is_object() {
                return Err(invalid("Некорректная запись."));
            }
            number(item, "occurredAt", 1.0, 8_640_000_000_000_000.0, true)?;
            if item.get("personalDate").is_some_and(|v| !v.is_boolean()) {
                return Err(invalid("Некорректная дата личного дня."));
            }
            let key = record_key(collection, item)?;
            if !keys.insert(key) {
                return Err(invalid("Идентификаторы записей повторяются."));
            }
            if ["tasks", "events"].contains(&collection) {
                text(item, "title", true)?;
                text(item, "description", false)?;
                text(item, "context", true)?;
                if collection == "events" || item.get("date").is_some_and(|s| s != "") {
                    day(item, "date")?;
                }
                if collection == "tasks" && item.get("createdDate").is_some() {
                    day(item, "createdDate")?;
                }
                number(item, "duration", 1.0, 1439.0, true)?;
                if item.get("done").is_some_and(|done| !done.is_boolean()) {
                    return Err(invalid("Некорректный статус задачи."));
                }
                if collection == "events" && minutes(item, "end")? <= minutes(item, "start")? {
                    return Err(invalid("Конец события должен быть позже начала."));
                }
            }
            if collection == "projects" {
                text(item, "name", true)?;
                text(item, "description", false)?;
            }
            if collection == "checkins" {
                number(item, "at", 0.0, 8_640_000_000_000_000.0, false)?;
                for field in ["mood", "energy", "stress"] {
                    number(item, field, 1.0, 5.0, false)?;
                }
                text(item, "note", false)?;
                if let Some(tags) = item.get("tags") {
                    if tags.as_array().is_none_or(|rows| {
                        rows.len() > 12
                            || rows.iter().any(|tag| {
                                tag.as_str()
                                    .is_none_or(|s| s.trim().is_empty() || s.chars().count() > 40)
                            })
                    }) {
                        return Err(invalid("Некорректные метки самочувствия."));
                    }
                }
            }
            if [
                "sleepLogs",
                "foodLogs",
                "workouts",
                "recoveryLogs",
                "waterLogs",
                "archiveItems",
            ]
            .contains(&collection)
            {
                day(item, "date")?;
            }
            if collection == "sleepLogs" {
                number(item, "hours", 0.0, 24.0, false)?;
                number(item, "quality", 1.0, 5.0, true)?;
            }
            if ["weightLogs", "illnessLogs", "nutrientLogs"].contains(&collection) {
                day(item, "date")?;
                text(item, "note", false)?;
                if item["note"]
                    .as_str()
                    .is_some_and(|v| v.chars().count() > 2000)
                {
                    return Err(invalid("Слишком длинная заметка здоровья."));
                }
            }
            if collection == "weightLogs" {
                number(item, "kg", 1.0, 1000.0, false)?;
            }
            if collection == "illnessLogs" && !item["until"].is_null() {
                day(item, "until")?;
                if item["until"].as_str() < item["date"].as_str() {
                    return Err(invalid("Выздоровление не может быть раньше болезни."));
                }
            }
            if collection == "nutrientLogs" {
                text(item, "name", true)?;
                text(item, "nutrientKey", true)?;
                number(item, "amount", 0.001, 1e9, false)?;
                if item["name"]
                    .as_str()
                    .is_some_and(|v| v.chars().count() > 100)
                    || item["nutrientKey"].as_str().is_some_and(|v| v.len() > 200)
                    || !matches!(item["unit"].as_str(), Some("мг" | "мкг" | "МЕ" | "г"))
                {
                    return Err(invalid("Некорректное вещество или единица."));
                }
            }
            if ["foodLogs", "savedMeals"].contains(&collection) {
                text(item, "name", true)?;
                number(item, "calories", 0.0, 10_000.0, false)?;
                for field in ["protein", "fat", "carbs"] {
                    number(item, field, 0.0, 1_000.0, false)?;
                }
                number(item, "grams", 0.1, 10_000.0, true)?;
                if item
                    .get("nutritionBasis")
                    .is_some_and(|v| !matches!(v.as_str(), Some("portion" | "100g")))
                {
                    return Err(invalid("Некорректная основа пищевых данных."));
                }
                if let Some(base) = item.get("nutritionBase") {
                    number(base, "calories", 0.0, 10_000.0, false)?;
                    for field in ["protein", "fat", "carbs"] {
                        number(base, field, 0.0, 1_000.0, false)?;
                    }
                }
            }
            if collection == "waterLogs" {
                number(item, "ml", 1.0, 10_000.0, false)?;
            }
            if collection == "workouts" {
                text(item, "name", true)?;
                number(item, "duration", 1.0, 1_440.0, false)?;
                number(item, "steps", 0.0, 200_000.0, true)?;
                number(item, "effort", 1.0, 5.0, true)?;
                if item
                    .get("effort")
                    .is_some_and(|v| !v.is_null() && v.as_u64().is_none())
                {
                    return Err(invalid("Оценка тренировки должна быть целой от 1 до 5."));
                }
                number(item, "effortRatedAt", 1.0, 8_640_000_000_000_000.0, true)?;
                validate_rest_settings(item)?;
                text(item, "trainingKey", false)?;
                text(item, "seriesKey", false)?;
                if let Some(entries) = item.get("entries") {
                    let entries = entries
                        .as_array()
                        .filter(|rows| rows.len() <= 200)
                        .ok_or_else(|| invalid("Некорректные упражнения тренировки."))?;
                    let mut exercise_keys = HashSet::new();
                    for entry in entries {
                        text(entry, "exerciseKey", true)?;
                        text(entry, "name", true)?;
                        if !exercise_keys.insert(entry["exerciseKey"].as_str())
                            || !matches!(entry["unit"].as_str(), Some("раз" | "кг" | "км" | "мин"))
                        {
                            return Err(invalid("Некорректное упражнение или единица."));
                        }
                        number(entry, "value", 0.0, 100_000.0, true)?;
                        number(entry, "effort", 1.0, 5.0, true)?;
                        if entry
                            .get("effort")
                            .is_some_and(|v| !v.is_null() && v.as_u64().is_none())
                        {
                            return Err(invalid("Оценка сложности должна быть целой от 1 до 5."));
                        }
                        number(entry, "effortRatedAt", 1.0, 8_640_000_000_000_000.0, true)?;
                        number(entry, "plannedValue", 0.0, 100_000.0, true)?;
                        number(entry, "sets", 1.0, 100.0, true)?;
                        if let Some(sets) = entry.get("setResults") {
                            let sets = sets
                                .as_array()
                                .filter(|rows| {
                                    rows.len() <= 100
                                        && rows.len() as u64 == entry["sets"].as_u64().unwrap_or(1)
                                })
                                .ok_or_else(|| invalid("Некорректные результаты подходов."))?;
                            for set in sets {
                                number(set, "value", 0.0, 100_000.0, true)?;
                                number(set, "reps", 0.0, 100_000.0, true)?;
                                number(set, "completedAt", 1.0, 8_640_000_000_000_000.0, true)?;
                                if !set["done"].is_boolean()
                                    || (set["done"] == true && !set["value"].is_number())
                                    || set["reps"].as_f64().is_some_and(|n| n.fract() != 0.0)
                                    || (entry["unit"] == "раз"
                                        && set["value"].as_f64().is_some_and(|n| n.fract() != 0.0))
                                {
                                    return Err(invalid("Некорректный результат подхода."));
                                }
                            }
                        }
                        if entry.get("done").is_some_and(|value| !value.is_boolean()) {
                            return Err(invalid("Некорректная отметка упражнения."));
                        }
                        number(entry, "completedAt", 1.0, 8_640_000_000_000_000.0, true)?;
                        if entry["sets"].as_f64().is_some_and(|n| n.fract() != 0.0)
                            || (entry["unit"] == "раз"
                                && entry["value"].as_f64().is_some_and(|n| n.fract() != 0.0))
                            || (entry["unit"] == "раз"
                                && entry["plannedValue"]
                                    .as_f64()
                                    .is_some_and(|n| n.fract() != 0.0))
                        {
                            return Err(invalid("Повторы и подходы должны быть целыми."));
                        }
                    }
                }
                if let Some(keys) = item.get("goalKeys") {
                    if keys.as_array().is_none_or(|rows| {
                        rows.len() > 1000
                            || rows.iter().any(|key| {
                                key.as_str().is_none_or(|s| s.is_empty() || s.len() > 200)
                            })
                    }) {
                        return Err(invalid("Некорректные ссылки на цели."));
                    }
                }
            }
            if collection == "stepLogs" {
                day(item, "date")?;
                number(item, "count", 0.0, 200_000.0, false)?;
                if item["count"].as_f64().is_some_and(|n| n.fract() != 0.0) {
                    return Err(invalid("Количество шагов должно быть целым."));
                }
            }
            if collection == "recoveryLogs" {
                number(item, "duration", 0.0, 1_440.0, false)?;
            }
            if collection == "trainingGoals" {
                text(item, "name", true)?;
                for field in ["baseline", "target"] {
                    number(item, field, 0.0, 100_000.0, false)?;
                }
                let current_limit = if item["calculation"].as_str() == Some("total") {
                    10_000_000_000_000.0
                } else {
                    100_000.0
                };
                number(item, "current", 0.0, current_limit, false)?;
                if let Some(calculation) = item.get("calculation") {
                    if !matches!(calculation.as_str(), Some("latest" | "total")) {
                        return Err(invalid("Некорректный способ расчёта цели."));
                    }
                }
                if item["target"].as_f64() <= item["baseline"].as_f64() {
                    return Err(invalid("Цель должна быть больше начального результата."));
                }
                text(item, "goalKey", false)?;
                text(item, "exerciseKey", false)?;
                if let Some(kind) = item.get("kind") {
                    if !matches!(kind.as_str(), Some("result" | "count")) {
                        return Err(invalid("Некорректный тип цели."));
                    }
                }
                if let Some(history) = item.get("history") {
                    for point in history
                        .as_array()
                        .filter(|rows| rows.len() <= 100_000)
                        .ok_or_else(|| invalid("Некорректная история цели."))?
                    {
                        number(point, "at", 1.0, 8_640_000_000_000_000.0, false)?;
                        number(point, "value", 0.0, 100_000.0, false)?;
                        if point
                            .get("initial")
                            .is_some_and(|value| !value.is_boolean())
                        {
                            return Err(invalid("Некорректная начальная запись цели."));
                        }
                    }
                }
                if item.get("from").is_some() {
                    day(item, "from")?;
                }
                if item["until"].as_str().is_some_and(|s| !s.is_empty()) {
                    day(item, "until")?;
                    if item["until"].as_str() < item["from"].as_str() {
                        return Err(invalid("Некорректный период цели."));
                    }
                }
            }
            if collection == "archiveItems" {
                text(item, "name", true)?;
                text(item, "category", true)?;
                text(item, "review", false)?;
                let rating_max = match item.get("ratingMax") {
                    None => 5.0,
                    Some(value) if value.as_f64() == Some(5.0) => 5.0,
                    Some(value) if value.as_f64() == Some(10.0) => 10.0,
                    _ => return Err(invalid("Шкала оценки должна быть 5 или 10.")),
                };
                number(item, "rating", 0.5, rating_max, true)?;
                if item["rating"]
                    .as_f64()
                    .is_some_and(|n| (n * 2.0).fract() != 0.0)
                {
                    return Err(invalid("Оценка должна быть кратна половине звезды."));
                }
            }
            if collection == "thoughts" {
                text(item, "title", true)?;
                text(item, "body", true)?;
                text(item, "context", true)?;
                day(item, "date")?;
            }
            if collection == "financeLogs" {
                number(item, "postedAt", 0.0, 8_640_000_000_000_000.0, true)?;
                if item
                    .get("legacyFinance")
                    .is_some_and(|flag| !flag.is_boolean())
                {
                    return Err(invalid("Некорректный статус старой операции."));
                }
                day(item, "date")?;
                number(item, "amount", 0.01, 1e12, false)?;
                text(item, "category", true)?;
                text(item, "note", false)?;
                text(item, "accountKey", false)?;
                text(item, "toAccountKey", false)?;
                if item["type"] == "transfer"
                    && (item["accountKey"].as_str().is_none_or(|s| s.is_empty())
                        || item["toAccountKey"].as_str().is_none_or(|s| s.is_empty())
                        || item["accountKey"] == item["toAccountKey"])
                {
                    return Err(invalid("Выберите разные счета для перевода."));
                }
                if !matches!(
                    item["type"].as_str(),
                    Some("income" | "expense" | "transfer")
                ) || !item["currency"]
                    .as_str()
                    .is_some_and(|s| s.len() == 3 && s.bytes().all(|b| b.is_ascii_uppercase()))
                {
                    return Err(invalid("Некорректная финансовая операция."));
                }
            }
            if collection == "exercises" {
                text(item, "name", true)?;
                number(item, "duration", 1.0, 1439.0, false)?;
            }
        }
    }
    let categories = state
        .get("archiveCategories")
        .and_then(Value::as_array)
        .ok_or_else(|| invalid("Нет коллекций архива."))?;
    if categories.len() > 1_000
        || categories.iter().any(|category| {
            category
                .as_str()
                .is_none_or(|s| s.trim().is_empty() || s.len() > 500)
        })
    {
        return Err(invalid("Некорректные коллекции архива."));
    }
    number(state, "nextId", 1.0, 9_007_199_254_740_991.0, false)?;
    number(state, "waterTarget", 1.0, 10_000.0, false)?;
    number(state, "foodTarget", 0.0, 10_000.0, false)?;
    if let Some(accounts) = state
        .get("uiPreferences")
        .and_then(|prefs| prefs.get("financeAccounts"))
    {
        let accounts = accounts
            .as_array()
            .filter(|rows| rows.len() <= 100)
            .ok_or_else(|| invalid("Некорректный список счетов."))?;
        let mut keys = HashSet::new();
        for account in accounts {
            text(account, "key", true)?;
            text(account, "name", true)?;
            day(account, "from")?;
            number(account, "opening", -1e12, 1e12, false)?;
            if !keys.insert(account["key"].as_str())
                || account["name"]
                    .as_str()
                    .is_none_or(|s| s.chars().count() > 80)
                || account["currency"]
                    .as_str()
                    .is_none_or(|s| s.len() != 3 || !s.bytes().all(|b| b.is_ascii_uppercase()))
            {
                return Err(invalid("Некорректный счёт."));
            }
        }
    }
    if let Some(budgets) = state
        .get("uiPreferences")
        .and_then(|prefs| prefs.get("financeBudgets"))
    {
        let budgets = budgets
            .as_array()
            .filter(|rows| rows.len() <= 1000)
            .ok_or_else(|| invalid("Некорректные бюджеты категорий."))?;
        for budget in budgets {
            text(budget, "category", true)?;
            number(budget, "limit", 0.01, 1e12, false)?;
            if budget["category"]
                .as_str()
                .is_none_or(|s| s.chars().count() > 100)
                || budget["currency"]
                    .as_str()
                    .is_none_or(|s| s.len() != 3 || !s.bytes().all(|b| b.is_ascii_uppercase()))
            {
                return Err(invalid("Некорректный бюджет категории."));
            }
        }
    }
    if let Some(templates) = state
        .get("uiPreferences")
        .and_then(|prefs| prefs.get("workoutTemplates"))
    {
        let templates = templates
            .as_array()
            .filter(|rows| rows.len() <= 100)
            .ok_or_else(|| invalid("Некорректный список сохранённых занятий."))?;
        let mut keys = HashSet::new();
        for template in templates {
            text(template, "key", true)?;
            text(template, "name", true)?;
            text(template, "note", false)?;
            number(template, "duration", 1.0, 1439.0, false)?;
            validate_rest_settings(template)?;
            if !keys.insert(template["key"].as_str())
                || template["key"].as_str().is_none_or(|s| s.len() > 200)
                || template["name"]
                    .as_str()
                    .is_none_or(|s| s.chars().count() > 150)
                || template["note"]
                    .as_str()
                    .is_none_or(|s| s.chars().count() > 100_000)
            {
                return Err(invalid("Некорректное сохранённое занятие."));
            }
            let entries = template["entries"]
                .as_array()
                .filter(|rows| rows.len() <= 200)
                .ok_or_else(|| invalid("Некорректные упражнения сохранённого занятия."))?;
            let mut exercise_keys = HashSet::new();
            for entry in entries {
                text(entry, "exerciseKey", true)?;
                text(entry, "name", true)?;
                number(entry, "plannedValue", 0.0, 100_000.0, true)?;
                number(entry, "sets", 1.0, 100.0, false)?;
                if !exercise_keys.insert(entry["exerciseKey"].as_str())
                    || !matches!(entry["unit"].as_str(), Some("раз" | "кг" | "км" | "мин"))
                    || entry["sets"].as_f64().is_some_and(|n| n.fract() != 0.0)
                    || (entry["unit"] == "раз"
                        && entry["plannedValue"]
                            .as_f64()
                            .is_some_and(|n| n.fract() != 0.0))
                {
                    return Err(invalid(
                        "Некорректный план упражнения сохранённого занятия.",
                    ));
                }
            }
        }
    }
    let archive_ids: HashSet<i64> = state["archiveItems"]
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|item| item["id"].as_i64())
        .collect();
    if state["uiPreferences"]["financeLedgerVersion"] == 1 {
        validate_finance_ledger(state)?;
    }
    if state["uiPreferences"]["taskDatesVersion"] == 1
        && !state["projects"]
            .as_array()
            .unwrap()
            .iter()
            .any(|row| row["system"] == "unassigned" && row["name"] == "Задачи без проекта и даты")
    {
        return Err(invalid(
            "Системный раздел задач нельзя удалить или переименовать.",
        ));
    }
    let mut cover_ids = HashSet::new();
    for (id, source) in &document.covers {
        if !archive_ids.contains(id)
            || !cover_ids.insert(*id)
            || source.len() > 8 * 1024 * 1024
            || !(source.starts_with("data:image/jpeg;base64,")
                || source.starts_with("data:image/png;base64,"))
        {
            return Err(invalid("Некорректная обложка архива."));
        }
    }
    Ok(())
}
fn validate_finance_ledger(state: &Value) -> Result<()> {
    let accounts: HashMap<&str, &Value> = state["uiPreferences"]["financeAccounts"]
        .as_array()
        .map(|rows| {
            rows.iter()
                .filter_map(|a| a["key"].as_str().map(|key| (key, a)))
                .collect()
        })
        .unwrap_or_default();
    if accounts
        .values()
        .any(|a| a["opening"].as_f64().unwrap_or(0.0) != 0.0)
    {
        return Err(invalid("Деньги добавляются только операцией дохода."));
    }
    let mut balances: HashMap<&str, i64> = accounts.keys().map(|key| (*key, 0)).collect();
    let mut rows: Vec<&Value> = state["financeLogs"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|row| row["legacyFinance"] != true)
        .collect();
    rows.sort_by(|a, b| {
        a["date"]
            .as_str()
            .cmp(&b["date"].as_str())
            .then_with(|| {
                b["openingCredit"]
                    .as_bool()
                    .unwrap_or(false)
                    .cmp(&a["openingCredit"].as_bool().unwrap_or(false))
            })
            .then_with(|| {
                a["postedAt"]
                    .as_i64()
                    .or(a["id"].as_i64())
                    .cmp(&b["postedAt"].as_i64().or(b["id"].as_i64()))
            })
            .then_with(|| a["id"].as_i64().cmp(&b["id"].as_i64()))
    });
    for row in rows {
        let key = row["accountKey"].as_str().unwrap_or("");
        let account = accounts
            .get(key)
            .ok_or_else(|| invalid("Выберите счёт для операции."))?;
        if account["currency"] != row["currency"] || row["date"].as_str() < account["from"].as_str()
        {
            return Err(invalid("Валюта или дата операции не соответствует счёту."));
        }
        let amount = (row["amount"].as_f64().unwrap() * 100.0).round() as i64;
        let income = row["type"] == "income";
        let balance = balances.get_mut(key).unwrap();
        if !income && *balance < amount {
            return Err(invalid(
                "Недостаточно средств на счёте. Отрицательный остаток запрещён.",
            ));
        }
        if income && *balance > 9_007_199_254_740_991 - amount {
            return Err(invalid("Сумма на счёте слишком велика для точного учёта."));
        }
        *balance += if income { amount } else { -amount };
        if row["type"] == "transfer" {
            let target_key = row["toAccountKey"].as_str().unwrap_or("");
            let target = accounts
                .get(target_key)
                .ok_or_else(|| invalid("Выберите счёт получателя."))?;
            if target_key == key
                || target["currency"] != row["currency"]
                || row["date"].as_str() < target["from"].as_str()
            {
                return Err(invalid("Выберите два разных счёта одной валюты."));
            }
            let target_balance = balances.get_mut(target_key).unwrap();
            if *target_balance > 9_007_199_254_740_991 - amount {
                return Err(invalid("Сумма на счёте слишком велика для точного учёта."));
            }
            *target_balance += amount;
        }
    }
    Ok(())
}
fn record_key(collection: &str, value: &Value) -> Result<String> {
    if ["sleepLogs", "stepLogs"].contains(&collection) {
        day(value, "date")?;
        return Ok(value["date"].as_str().unwrap().to_owned());
    }
    let field = if collection == "checkins" { "at" } else { "id" };
    value
        .get(field)
        .and_then(Value::as_i64)
        .filter(|id| *id > 0)
        .map(|id| id.to_string())
        .ok_or_else(|| invalid("Некорректный идентификатор записи."))
}

impl Repository {
    pub fn load_workspace(&mut self) -> Result<WorkspaceDocument> {
        let tx = self.connection.transaction()?;
        let row: Option<(i64, String)> = tx
            .query_row(
                "SELECT revision, settings FROM workspace_document WHERE id=1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()?;
        let Some((revision, settings)) = row else {
            drop(tx);
            let data = self.import_legacy_workspace()?;
            let mut document = WorkspaceDocument {
                revision: 0,
                data,
                covers: vec![],
            };
            document.revision = self.save_workspace(&document)?;
            return Ok(document);
        };
        let mut data: Value = serde_json::from_str(&settings).map_err(|_| {
            invalid("Повреждены настройки рабочего пространства. Восстановите резервную копию.")
        })?;
        for collection in COLLECTIONS {
            let mut statement = tx.prepare(
                "SELECT payload FROM workspace_records WHERE collection=?1 ORDER BY position",
            )?;
            let rows = statement.query_map([collection], |row| row.get::<_, String>(0))?;
            let mut items = Vec::new();
            for row in rows {
                items.push(
                    serde_json::from_str(&row?)
                        .map_err(|_| invalid("Повреждена запись рабочего пространства."))?,
                );
            }
            data[collection] = Value::Array(items);
        }
        let mut statement =
            tx.prepare("SELECT item_id,source FROM workspace_covers ORDER BY item_id")?;
        let covers = statement
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        drop(statement);
        tx.commit()?;
        if data["version"] == 30 || data["version"] == 31 {
            data["version"] = json!(32);
        }
        let document = WorkspaceDocument {
            revision: revision as u64,
            data,
            covers,
        };
        validate_workspace(&document)?;
        Ok(document)
    }
    pub fn save_workspace(&mut self, document: &WorkspaceDocument) -> Result<u64> {
        validate_workspace(document)?;
        let mut settings = document.data.as_object().unwrap().clone();
        for collection in COLLECTIONS {
            settings.remove(collection);
        }
        let settings = serde_json::to_string(&settings)
            .map_err(|_| invalid("Не удалось подготовить настройки."))?;
        let tx = self
            .connection
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let current: i64 = tx
            .query_row(
                "SELECT revision FROM workspace_document WHERE id=1",
                [],
                |row| row.get(0),
            )
            .optional()?
            .unwrap_or(0);
        if current as u64 != document.revision {
            return Err(invalid("Данные изменены в другом окне. Сохраните резервную копию текущих изменений, затем перезапустите приложение."));
        }
        for collection in COLLECTIONS {
            let mut existing: HashSet<String> = {
                let mut statement =
                    tx.prepare("SELECT record_key FROM workspace_records WHERE collection=?1")?;
                let rows = statement
                    .query_map([collection], |row| row.get(0))?
                    .collect::<rusqlite::Result<HashSet<_>>>()?;
                rows
            };
            for (position, value) in document.data[collection]
                .as_array()
                .into_iter()
                .flatten()
                .enumerate()
            {
                let key = record_key(collection, value)?;
                existing.remove(&key);
                let payload = serde_json::to_string(value)
                    .map_err(|_| invalid("Не удалось подготовить запись."))?;
                tx.execute("INSERT INTO workspace_records(collection,record_key,position,payload) VALUES(?1,?2,?3,?4) ON CONFLICT(collection,record_key) DO UPDATE SET position=excluded.position,payload=excluded.payload WHERE position<>excluded.position OR payload<>excluded.payload", params![collection,key,position as i64,payload])?;
            }
            for key in existing {
                tx.execute(
                    "DELETE FROM workspace_records WHERE collection=?1 AND record_key=?2",
                    params![collection, key],
                )?;
            }
        }
        let mut existing_covers: HashSet<i64> = {
            let mut statement = tx.prepare("SELECT item_id FROM workspace_covers")?;
            let ids = statement
                .query_map([], |row| row.get(0))?
                .collect::<rusqlite::Result<HashSet<_>>>()?;
            ids
        };
        for (id, source) in &document.covers {
            existing_covers.remove(id);
            tx.execute("INSERT INTO workspace_covers(item_id,source) VALUES(?1,?2) ON CONFLICT(item_id) DO UPDATE SET source=excluded.source WHERE source<>excluded.source", params![id,source])?;
        }
        for id in existing_covers {
            tx.execute("DELETE FROM workspace_covers WHERE item_id=?1", [id])?;
        }
        let revision = current
            .checked_add(1)
            .ok_or_else(|| invalid("Слишком много изменений."))?;
        tx.execute("INSERT INTO workspace_document(id,revision,settings,updated_at) VALUES(1,?1,?2,?3) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,settings=excluded.settings,updated_at=excluded.updated_at", params![revision,settings,now()])?;
        tx.commit()?;
        if self
            .last_backup
            .is_none_or(|at| at.elapsed() >= std::time::Duration::from_secs(3600))
        {
            let mut copy = document.clone();
            copy.revision = revision as u64;
            match crate::backups::write_snapshot(&self.backup_root, &copy, "hourly") {
                Ok(_) => {
                    self.last_backup = Some(std::time::Instant::now());
                    self.backup_error = None;
                }
                Err(error) => {
                    self.backup_error = Some(error);
                }
            }
        }
        Ok(revision as u64)
    }
    fn import_legacy_workspace(&mut self) -> Result<Value> {
        let legacy = self.snapshot()?;
        let today = Local::now().date_naive().to_string();
        let mut state = Map::new();
        for name in COLLECTIONS {
            state.insert(name.into(), json!([]));
        }
        let mut next_id: i64 = 1;
        let mut project_names = HashMap::new();
        for project in legacy.projects {
            project_names.insert(project.id.clone(), project.title.clone());
            state.get_mut("projects").unwrap().as_array_mut().unwrap().push(json!({"id":next_id,"name":project.title,"description":project.description,"tone":"pine","legacyId":project.id,"legacyStatus":project.status}));
            next_id += 1;
        }
        for task in legacy.tasks {
            let context = task
                .project_id
                .as_ref()
                .and_then(|id| project_names.get(id))
                .cloned()
                .unwrap_or_else(|| "Личное".into());
            state.get_mut("tasks").unwrap().as_array_mut().unwrap().push(json!({"id":next_id,"title":task.title,"description":task.notes.unwrap_or_default(),"context":context,"date":task.scheduled_date.or(task.due_date).unwrap_or_else(||today.clone()),"done":task.status.as_str()=="completed","duration":30,"status":if task.status.as_str()=="completed" {"done"} else {"planned"},"legacyId":task.id}));
            next_id += 1;
        }
        for item in legacy
            .inbox_items
            .into_iter()
            .filter(|item| item.processed_at.is_none())
        {
            state.get_mut("tasks").unwrap().as_array_mut().unwrap().push(json!({"id":next_id,"title":item.content,"context":"Личное","date":today,"done":false,"duration":30,"legacyId":item.id}));
            next_id += 1;
        }
        for entry in legacy.checkins.into_iter().rev() {
            let at = DateTime::parse_from_rfc3339(&entry.updated_at)
                .map(|at| at.timestamp_millis())
                .unwrap_or(1);
            let score =
                |value: Option<i32>| ((value.unwrap_or(5) as f64 / 2.0).ceil() as i32).clamp(1, 5);
            state.get_mut("checkins").unwrap().as_array_mut().unwrap().push(json!({"at":at,"mood":score(entry.mood),"energy":score(entry.energy),"stress":score(entry.stress),"note":entry.note.unwrap_or_default()}));
            if let Some(minutes) = entry.sleep_minutes {
                state.get_mut("sleepLogs").unwrap().as_array_mut().unwrap().push(json!({"date":entry.date,"hours":minutes as f64/60.0,"quality":null,"note":""}));
            }
        }
        let mut categories = vec!["Фильмы", "Книги", "Аниме"];
        if !legacy.wins.is_empty() {
            categories.push("Моменты");
        }
        for entry in legacy.wins {
            state.get_mut("archiveItems").unwrap().as_array_mut().unwrap().push(json!({"id":next_id,"category":"Моменты","name":entry.title,"date":entry.occurred_at.get(..10).unwrap_or(&today),"rating":null,"review":entry.note.unwrap_or_default()}));
            next_id += 1;
        }
        if !legacy.reviews.is_empty() {
            categories.push("Размышления");
        }
        for review in legacy.reviews {
            let text = legacy
                .review_entries
                .iter()
                .filter(|entry| entry.review_id == review.id)
                .map(|entry| format!("{}\n{}", entry.section, entry.content))
                .collect::<Vec<_>>()
                .join("\n\n");
            state.get_mut("archiveItems").unwrap().as_array_mut().unwrap().push(json!({"id":next_id,"category":"Размышления","name":format!("Неделя {}",review.period_start),"date":review.period_start,"rating":null,"review":text}));
            next_id += 1;
        }
        state.extend(json!({"version":32,"nextId":next_id,"waterTarget":2000,"foodTarget":0,"archiveCategories":categories,"selectedDate":today,"selectedLifeDay":today,"selectedArchiveCategory":"Фильмы","range":"six","palette":"sun","appearance":"system","activePage":"home","lifeTab":"mood","lifeDetailOpen":false,"customColor":"#8c6ad8","languageMode":"system","fontMode":"system"}).as_object().unwrap().clone());
        Ok(Value::Object(state))
    }
}

#[cfg(test)]
mod rest_settings_tests {
    use super::*;

    #[test]
    fn optional_rest_settings_preserve_old_records() {
        for value in [
            json!({}),
            json!({"restSeconds":5,"restAutomatic":true,"restSound":false}),
            json!({"restSeconds":300}),
        ] {
            assert!(validate_rest_settings(&value).is_ok());
        }
    }

    #[test]
    fn invalid_rest_settings_are_rejected() {
        for value in [
            json!({"restSeconds":0}),
            json!({"restSeconds":301}),
            json!({"restSeconds":10.5}),
            json!({"restSeconds":"60"}),
            json!({"restSeconds":null}),
            json!({"restSound":"true"}),
            json!({"restAutomatic":1}),
        ] {
            assert!(validate_rest_settings(&value).is_err());
        }
    }
}
