# Backups and recovery

English | [Русский](BACKUPS.md)

## Choose a backup type

For a reinstall or a move to another device, use **Settings → Data → Encrypted backup**. Save it outside the app and store the password separately. Orvim does not save the password. This is the backup to use when following the [old Android test build migration guide](INSTALLATION.en.md#migrating-from-an-older-test-apk).

Since 0.4.24, the installed app encrypts its database and automatic backups with a device key. Reinstalling the app can lose that key. Automatic mirroring to external storage is disabled because device-key backups cannot be restored after uninstalling the app. Older external backups may still be unencrypted.

| Type               | Use                                                                    | Limits                                                                   |
| ------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Encrypted backup   | Move your records and cover images, or restore them after reinstalling | Keep the password and verify a restore first.                            |
| JSON export        | Transfer workspace records and cover images through the app            | Unencrypted. Read the replacement preview before restoring.              |
| Automatic snapshot | Recover from a mistake or a problem with a recent change               | The app retains the latest 24 snapshots protected by the device key.     |
| SQLite snapshot    | Preserve a consistent database before a version change or migration    | Created with `VACUUM INTO`. Use the app’s recovery flow to restore data. |
| CSV export         | View or analyze exported records                                       | Unencrypted and incomplete as a backup.                                  |
| LAN sync           | Exchange records between paired installations                          | Changes and mistakes can propagate. Keep independent backups.            |

Managed backups include records and cover images. The app excludes connection settings and secrets when preparing snapshots. A password typed into a note is treated as ordinary text. Restore an encrypted backup through Settings or from the startup screen if the app cannot open its database. Versions older than 0.4.24 cannot read the encrypted SQLite file directly. [Encryption details (Russian)](ENCRYPTION.md)

## Where backups are stored

- **Windows:** Orvim uses the existing `Documents/Life OS/backups` folder if present, otherwise `Documents/Orvim/backups`. Windows can redirect the Documents folder.
- **Android:** Automatic backups are in the private `automatic-backups` directory. When creating an **Encrypted backup**, use the system file picker to save it outside the app.
- **Exports:** You choose where to save the file. Keep a separate copy off the device.

The change from Life OS to Orvim preserves the existing database location.

## Verify a transfer or restore

1. Wait for your changes to finish saving on the original device.
2. In **Settings → Data**, create an **Encrypted backup**.
3. Save it somewhere independent of the app and check its date and file size.
4. Install a compatible version on the receiving device.
5. Start the restore and read the replacement preview before confirming it.
6. Check your records and cover images, then restart Orvim and check them again.

Keep the original installation until you have verified the result. Enter provider API keys separately on the receiving device.

## Compatibility and recovery

The current SQLite schema version is 3 and the workspace document version is 32. Check compatibility before opening newer data with an older installation.

If Orvim opens to an empty workspace or shows an error, stop syncing. Keep the source files and any backups, and write down the version and the steps that led to the issue. Use the built-in recovery manager. Create another snapshot before replacing data and keep the SQLite and associated WAL/SHM files together while the database is open.

Android can block downgrades to a lower `versionCode`. [Manual installation and rollback (Russian)](UPDATES.md#установка-и-откат)

Automatic history saves at most one snapshot an hour after changes during normal use. Starting the app or performing an important operation may create extra snapshots. New snapshots replace older ones once the app reaches 24. For a reinstall or transfer, keep a separate password-protected backup.
