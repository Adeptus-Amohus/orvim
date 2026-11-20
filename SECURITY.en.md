# Orvim security

English | [Русский](SECURITY.md)

## Reporting a vulnerability

Contact the repository owner privately. If GitHub offers **Security → Report a vulnerability** for the repository, you can use it. The project has no announced security email, bug bounty, or guaranteed response time.

Include the Orvim version, OS, installation method, minimal steps to reproduce the issue, and its expected impact. Use sample records and remove credentials, personal server addresses, and backup contents from your report. Keep live credentials and personal records out of public issues.

## Security boundaries

- The installed app encrypts SQLite and internal automatic backups with a device key. Portable backups use a separate password. Standard JSON and CSV exports, separately saved attachments, and browser preview data are unencrypted. [Encryption details (Russian)](docs/ENCRYPTION.md)
- Windows protects credentials with DPAPI. Android uses the platform’s protected storage. These protections depend on a trustworthy operating system.
- LAN sync requires pairing and encrypts the exchange. Enable it on a private network you trust and remove pairings you no longer need. The current sync implementation uses LAN and file transfers. [Sync guide (Russian)](docs/SYNC_0_4.md)
- Orvim treats AI responses and imports as untrusted data and validates changes. Review the preview when the app offers one before applying changes.
- In-app updates require a trusted public key, a signed manifest, and package verification. The update manifest signature, Windows installer signature, and Android signing certificate serve different purposes.

[Data and privacy](docs/PRIVACY.en.md) · [Update architecture (Russian)](docs/UPDATES.md) · [Security review, fixes, and encryption plan (Russian)](docs/SECURITY_AUDIT_2026_10_25.md)

## Supported versions

Orvim is in development on the 0.4.x release line. There is no separate support schedule for older versions. See the [current release notes](docs/releases/0.4.48.en.md) for release-specific verification.
