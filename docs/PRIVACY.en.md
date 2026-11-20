# Data and privacy

English | [Русский](PRIVACY.md)

## What stays on your device

Orvim stores tasks, projects, thoughts, daily logs, finances, workout records, settings, and cover images in SQLite. Workspace data and backups can also include assistant conversations and saved context. Windows and Android installations have separate databases.

Orvim caches the interface language in localStorage (`orvim-interface-language`) so that startup and database errors appear in the chosen language. The cache contains an unencrypted `ru`, `en`, or `system` value.

The assistant’s **Data for AI** panel remembers the sections or records you select, including the chosen date range. These are sent when you next submit a message. Selecting an entire section also includes newly added records in that section. Use **Remove all** to clear the selection. Clearing the conversation clears the selection too. The panel shows a preview of what the AI provider will receive. Opening the chat by itself sends nothing.

Tauri uses the operating system’s `app_local_data_dir` for `local.lifeos.client`. A new database is named `orvim.sqlite3`. If `life-os.sqlite3` already exists, Orvim continues to use it. The browser preview uses its own `life-os-preview` IndexedDB database, which can be lost if you clear browser data.

The installed app encrypts its database and automatic internal backups with a device key. Use a separate password-protected backup for a transfer or reinstall. Standard JSON and CSV exports, separately saved attachments, and browser preview data are unencrypted. Older external backups retain their existing format. [Backups and recovery](BACKUPS.en.md) · [Encryption details (Russian)](ENCRYPTION.md)

## Keys and permissions

Orvim stores API and OAuth secrets separately from normal exports using Windows DPAPI or Android’s protected storage. Connection settings are excluded when the app prepares snapshots. Keep credentials out of notes, assistant messages, and other record fields, where they are treated as ordinary text and can be included in a backup or selected context.

The key for **Other JSON API** is bound to the HTTPS origin (scheme, host, and port) set when saving it. Save the key again if you change servers. A previously saved key without an associated origin is withheld until you save it again. API paths can differ within the same origin. Requests carrying credentials do not follow redirects.

LAN sync encrypts data in transit. Local SQLite sync journals are encrypted as well, with existing journals migrated during an update.

Orvim requests notification, calendar, QR camera, and Health Connect permissions for the relevant actions. Revoke permissions in the operating system. For voice input, the OS keyboard or input service handles audio, and Orvim receives the resulting text. An AI provider receives that text when you send the message. The earlier 0.4.35 packages included the old built-in dictation feature.

## When Orvim uses the network

| Action                               | Recipient and data                                                                                                                            |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Check an AI key or list models       | The chosen provider receives authorization and the model-list request, without workspace records.                                             |
| Send an AI message                   | The provider receives the prompt, conversation or context, the records you selected, and instructions.                                        |
| Find and load cover art              | A catalog receives the title and search query. The app then requests the image from an allowed host.                                          |
| Notion, JSON API, or Google Calendar | The relevant service receives authenticated requests and data for the import or export.                                                       |
| LAN sync                             | The paired device receives encrypted records and metadata.                                                                                    |
| Check for updates                    | Orvim contacts GitHub or the configured HTTPS update channel. Credentials in a local Git client do not give Orvim access to private releases. |

Core features work offline, independently of these connections. Orvim does not configure a first-party analytics service. The operating system, WebView, input service, and external providers may handle their own telemetry and data.

On Android, Orvim reads Health Connect data after you grant permission. Imported entries become local records. They can leave the device if you later include them in an export, sync, or assistant request. [Health Connect guide (Russian)](HEALTH_CONNECT.md)

## Deleting and transferring records

Deleting a record can propagate to paired devices. Independent older backups retain their contents. Confirming a full data wipe in Orvim clears local records, settings, keys, pairings, and internal backups. Separately exported files and data on other devices or servers remain under your control. Uninstalling on Android erases private app data while leaving independently saved copies.

Revoke provider keys you no longer use, disconnect unwanted sync pairings, and review exports before sharing them. Your own records retain their own terms. [Licenses (Russian)](LICENSES.md) · [Security policy](../SECURITY.md)
