# Orvim security

<details>
<summary><strong>Читать на русском</strong></summary>

# Безопасность Orvim

## Сообщение об уязвимости

Сообщите об уязвимости приватно: [напишите автору по электронной почте](mailto:a.baimurzinov1@gmail.com?subject=Orvim%20security%20report). Это общий адрес автора, а не отдельный security email; аккаунт GitHub не нужен. Приватные отчёты об уязвимостях через GitHub для этого репозитория сейчас отключены. Не создавайте публичный issue и не публикуйте подробности эксплуатации до связи с автором. Программа вознаграждений и гарантированный срок ответа не объявлены.

Укажите версию, ОС, способ установки, минимальные шаги и ожидаемое влияние. Используйте тестовые записи; удалите ключи, адреса личных серверов и содержимое копий. Не публикуйте действующие токены или личную базу.

## Границы защиты

- В установленном приложении SQLite и внутренние автоматические копии зашифрованы ключом устройства. Переносимые копии с паролем имеют отдельную защиту. Обычный JSON/CSV экспорт, отдельно сохранённые вложения и браузерный предпросмотр остаются открытыми. Подробности: [ENCRYPTION.md](docs/ENCRYPTION.md).
- Windows защищает секреты через DPAPI; Android использует платформенное защищённое хранилище. Это не защищает от уже скомпрометированной ОС.
- LAN требует сопряжения и шифрует обмен; сервис слушает сетевые интерфейсы. Разрешайте его в доверенной частной сети и отзывайте лишние сопряжения.
- WebDAV удалён из действующего обмена. Перенос через файл и LAN описаны в [SYNC_0_4.md](docs/SYNC_0_4.md).
- Ответы ИИ и импорт — недоверенные данные. Изменения проходят валидацию; предусмотренный интерфейсом предпросмотр нужно прочитать до применения.
- Обновления из приложения требуют доверенного открытого ключа, подписи манифеста и проверки пакета. Подпись Windows EXE, подпись манифеста и сертификат APK — разные механизмы.

Подробнее: [приватность](docs/PRIVACY.md), [синхронизация](docs/SYNC_0_4.md), [обновления](docs/UPDATES.md).

Проведённый обзор, исправления и отдельный план шифрования: [аудит 25 октября 2026](docs/SECURITY_AUDIT_2026_10_25.md). Это не сертификат отсутствия уязвимостей.

## Поддерживаемые версии

Проект находится в разработке. Текущая рабочая линия — 0.4.x; отдельная матрица security-поддержки старых версий не установлена. Версия не означает, что все устройства и проверки уже пройдены; смотрите заметки конкретного выпуска.

</details>

## Reporting a vulnerability

Report vulnerabilities privately by [emailing the maintainer](mailto:a.baimurzinov1@gmail.com?subject=Orvim%20security%20report). This is the general maintainer address, not a dedicated security mailbox; you do not need a GitHub account. Private vulnerability reporting on GitHub is currently disabled for this repository. Do not open a public issue or publish exploit details before contacting the maintainer. There is no bug bounty or guaranteed response time.

Include the Orvim version, OS, installation method, minimal steps to reproduce the issue, and its expected impact. Use sample records and remove credentials, personal server addresses, and backup contents from your report. Keep live credentials and personal records out of public issues.

## Security boundaries

- The installed app encrypts SQLite and internal automatic backups with a device key. Portable backups use a separate password. Standard JSON and CSV exports, separately saved attachments, and browser preview data are unencrypted. [Encryption details (Russian)](docs/ENCRYPTION.md)
- Windows protects credentials with DPAPI. Android uses the platform’s protected storage. These protections depend on a trustworthy operating system.
- LAN sync requires pairing and encrypts the exchange. Enable it on a private network you trust and remove pairings you no longer need. The current sync implementation uses LAN and file transfers. [Sync and transfers](docs/SYNC_0_4.en.md)
- Orvim treats AI responses and imports as untrusted data and validates changes. Review the preview when the app offers one before applying changes.
- In-app updates require a trusted public key, a signed manifest, and package verification. The update manifest signature, Windows installer signature, and Android signing certificate serve different purposes.

[Data and privacy](docs/PRIVACY.en.md) · [Update architecture (Russian)](docs/UPDATES.md) · [Security review, fixes, and encryption plan (Russian)](docs/SECURITY_AUDIT_2026_10_25.md)

## Supported versions

Orvim is in development on the 0.4.x release line. There is no separate support schedule for older versions. See the [current release notes](docs/releases/0.4.48.en.md) for release-specific verification.
