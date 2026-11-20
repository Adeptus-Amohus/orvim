# Contributing to Orvim

<details>
<summary><strong>Читать на русском</strong></summary>

# Участие в Orvim

Начните с [обзора Orvim](README.ru.md), [разработки](docs/DEVELOPMENT.md) и [архитектуры](docs/ARCHITECTURE.md). Гарантированные сроки поддержки не установлены.

## Отзывы и сообщения об ошибках

- Вопросы и отзывы можно [отправить по электронной почте](mailto:a.baimurzinov1@gmail.com).
- Воспроизводимую ошибку можно [описать на GitHub](https://github.com/Adeptus-Amohus/orvim/issues/new?template=bug.yml) после входа в аккаунт. Укажите версию Orvim, устройство и версию ОС, шаги, ожидаемый и фактический результат.
- Публичный отчёт должен содержать только примеры без личных данных. Ключи, рабочие копии базы и скриншоты личных записей оставьте у себя. Об уязвимостях сообщайте [приватно](SECURITY.ru.md#сообщение-об-уязвимости).

## Изменения

Создавайте отдельную ветку от согласованной рабочей версии. Объясните конкретный сценарий, поведение до/после и выполненные проверки. Добавляйте регрессионный тест, если исправление затрагивает сохранение, преобразование данных, синхронизацию или воспроизводимую ошибку поведения.

Windows и Android используют общий интерфейс и модель данных. Не меняйте local.lifeos.client, формат копий, имена защищённого хранилища и протокол обмена простой заменой бренда. Изменение схемы требует миграции, проверки открытия старой базы и сценария восстановления.

Интерфейс проверяйте на узких экранах, с клавиатурой, в светлом и тёмном режиме. Нативные сценарии выполняйте с отдельным QA-хранилищем. DOM-тест не подтверждает физические жесты или системные разрешения.

## Проверки

Запустите применимые команды из [DEVELOPMENT.md](docs/DEVELOPMENT.md#проверки). Не отключайте lint или валидацию ради прохождения набора. Если исходная ветка уже содержит сбой, укажите его отдельно от результата своей правки.

Обновляйте документацию при изменении команд, хранения, разрешений, зависимостей или внешних запросов. После изменения зависимостей обновляйте [лицензии](third-party/README.md).

## Что не добавлять в Git

Личные базы и копии, API/OAuth-ключи, ключи подписи, keystore, дампы с записями пользователя, SDK/JDK, node_modules, сборки, .artifacts, .codex-remote-attachments и кеши. Используйте синтетические примеры и удаляйте секреты из отчётов.

## Условия вкладов

Собственные изменения, намеренно предоставленные для включения в проект, подпадают под раздел 5 существующей [Apache-2.0](LICENSE), если отдельно не согласовано иное. Сохраняйте чужие лицензии и атрибуцию; добавляйте только материалы, которые вправе распространять. Отдельное CLA этим документом не вводится.

Для уязвимостей используйте [SECURITY.ru.md](SECURITY.ru.md), а не публичный пример с личными данными.

</details>

Start with the [Orvim overview](README.md), then see the [development guide (Russian)](docs/DEVELOPMENT.md) and [architecture (Russian)](docs/ARCHITECTURE.md) if you want to work on the code. The project has no guaranteed support response times.

## Feedback and bug reports

- [Email the maintainer](mailto:a.baimurzinov1@gmail.com) if you have a question, an idea, or feedback about how Orvim works for you. A GitHub account is unnecessary for email.
- If you can reproduce a bug, [open a GitHub issue](https://github.com/Adeptus-Amohus/orvim/issues/new?template=bug-en.yml). Sign in to GitHub, then include your Orvim version, device and OS version, the steps to reproduce the problem, what you expected, and what happened.
- Use sample records in public reports and screenshots. Keep personal data, database backups, and credentials private. For security issues, follow the [private reporting instructions](SECURITY.md#reporting-a-vulnerability).

## Changes

Create a separate branch from the agreed base version. Describe the user scenario, the behavior before and after the change, and what you checked. Add a regression test for changes that affect persistence, data conversion, synchronization, or a reproducible bug.

Windows and Android share the interface and data model. Keep `local.lifeos.client`, the backup format, secure storage names, and the sync protocol stable during branding changes. Schema changes require a migration and checks for opening an old database and recovering it.

Check the interface on narrow screens, with a keyboard, and in light and dark mode. Use separate test storage for native checks. DOM tests cover interface behavior, while native checks are needed for physical gestures and operating system permissions.

## Checks

Run the applicable checks from the [development guide (Russian)](docs/DEVELOPMENT.md#проверки). Keep lint and validation enabled. If the base branch already has a failure, report it separately from the results of your change.

Update the documentation when you change commands, storage, permissions, dependencies, or network requests. Update the [license inventory (Russian)](third-party/README.md) when dependencies change.

## Keep private and generated files out of Git

Leave personal databases, backups, API and OAuth keys, signing keys, keystores, dumps with user records, SDKs, JDKs, `node_modules`, builds, `.artifacts`, `.codex-remote-attachments`, and caches out of Git. Use sample records and remove secrets from reports.

## Contribution terms

Contributions intentionally submitted for inclusion are governed by Section 5 of the existing [Apache License 2.0](LICENSE) unless otherwise agreed. Preserve existing licenses and attribution, and include only material you have permission to share. This document adds no separate contributor license agreement.
