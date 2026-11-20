# Install or update Orvim 0.4.48

English | [Русский](INSTALLATION.md)

The [public release](https://github.com/Adeptus-Amohus/orvim/releases/tag/v0.4.48) contains the APK, Windows installer, documentation, SHA-256 checksums, and licenses. Download the installer for your device and follow the steps below. A GitHub account and development tools are unnecessary.

## Android

You need Android 7.0 (API 24) or later, an ARM64 device (`arm64-v8a`), and an up-to-date Android WebView. The release contains an ARM64 APK. Health Connect has its own Android version and permission requirements.

1. Download [Orvim-0.4.48-Android-arm64.apk](https://github.com/Adeptus-Amohus/orvim/releases/download/v0.4.48/Orvim-0.4.48-Android-arm64.apk).
2. Compare the downloaded file’s SHA-256 checksum with the entry in [SHA256SUMS.txt](https://github.com/Adeptus-Amohus/orvim/releases/download/v0.4.48/SHA256SUMS.txt).
3. Open the APK with your file manager. Android may ask you to allow that file manager to install apps. Confirm you downloaded the APK from the official release before granting permission.
4. Open Orvim. If you are moving from another installation, restore your portable backup, restart Orvim, and check that your records are still there.

The release uses app ID `local.lifeos.client`, version `0.4.48`, and `versionCode 4048`. Regular release updates retain the app ID and signing certificate and increase `versionCode`.

### Migrating from an older test APK

Test APKs up to and including 0.4.45 use a different signing certificate. Android requires you to uninstall the test build before installing a release build. Uninstalling can erase the app’s private database and device key.

1. In the old app, create a password-protected backup under **Settings → Data → Encrypted backup**. Save it outside the app’s private folder, keep a second copy on separate storage, and store the password separately.
2. **Test the restore** on a separate installation or device. Check your records and cover images, restart Orvim, and check them again. Keep the old APK and leave its installation in place until you have confirmed that the backup restores.
3. Once you have verified the backup, uninstall the old test build and install the release APK.
4. Restore the encrypted backup, check your records, and set up any external connections and widgets again.

Automatic backups depend on a device key, and CSV exports contain only part of your data. If you cannot verify the restore, keep the old installation until you can transfer your records safely. [Backups and recovery](BACKUPS.en.md)

## Windows

You need Windows 10 or 11 (x64) and Microsoft Edge WebView2 Evergreen Runtime. If WebView2 is missing, the installer needs an internet connection to download it from Microsoft.

1. Download [Orvim-0.4.48-Windows-x64-setup.exe](https://github.com/Adeptus-Amohus/orvim/releases/download/v0.4.48/Orvim-0.4.48-Windows-x64-setup.exe) and compare its SHA-256 with [SHA256SUMS.txt](https://github.com/Adeptus-Amohus/orvim/releases/download/v0.4.48/SHA256SUMS.txt).
2. If you are updating, create a portable encrypted backup first. Then choose **Exit** in the Orvim system tray menu to close the app.
3. Run the installer. For an update, use the existing installation folder so Orvim can continue to use your current data. Older Life OS paths are retained for compatibility.
4. Open Orvim, then restart it and check your records.

Windows or SmartScreen may show an unknown publisher warning because the EXE is unsigned. If you are unsure where your installer came from, download a fresh copy from the public release and verify its checksum.

To uninstall, use **Settings → Apps → Orvim → Uninstall**. Leave the option to remove user data unchecked if you want to keep those files, and store a separate backup.

## First launch

1. Open Orvim. On **Home**, pick a date in the schedule and use **+** in the **Tasks** panel to add your first task.
2. Use **Thoughts** to jot down an idea, or open **Projects** to keep tasks and reference materials together.
3. To change the language, open **Settings → Appearance → Interface language**. Core features work offline and without an Orvim account.

[Backups and recovery](BACKUPS.en.md) · [Ask a question or report a bug](../CONTRIBUTING.en.md#feedback-and-bug-reports)

## Updates and verification

If **Check GitHub** returns a 404 in 0.4.46 or 0.4.47, download 0.4.48 and install it over your existing release. Starting with 0.4.48, the app checks public releases and verifies a signed update manifest when one is available. Installation requires your confirmation. [0.4.48 release notes](releases/0.4.48.en.md)

Release checks covered installation, startup, updates or package replacement, and data retention in the available environments. Testing did not cover a physical ARM64 phone, every Android launcher, a physical device on API 24, a clean Windows installation without WebView2, or live AI, Google, Notion, and Health Connect accounts. [Verification report and build provenance](https://github.com/Adeptus-Amohus/orvim/releases/download/v0.4.48/Verification.md)
