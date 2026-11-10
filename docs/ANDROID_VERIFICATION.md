# Android foundation verification

Dates: 2026-09-21–22. Branch: `feature/android-foundation`, based on committed MVP
`8bf8876`. No product features were added.

## Environment and scope

Windows host: Node 24.21.0, npm 11.19.0, Rust/Cargo 1.98.1 MSVC. Android uses
SDK `B:\andSDK`, NDK r30 (`30.0.16248370`), Platform 36, Gradle 8.14.3,
and portable Temurin JDK 21.0.12.1+1. Process-local environment variables were
used; global machine environment settings were not changed.

The existing tools lacked Android Rust targets, a stable API 36 platform/image,
and an AVD. ARM64/x86_64 Rust targets, Platform 36, the Google APIs x86_64 image,
and `LifeOS_API_36` were added. Gradle also installed its required Build Tools
35.0.0 alongside the existing 36.0.0. JDK 21 was unpacked into ignored local QA
storage because Android Studio's Java 25 is unsupported by this Gradle wrapper.

Test device: Pixel 8 AVD, Android 16/API 36, x86_64, WebView 133.0.6943.137.
WHPX acceleration with SwiftShader and Vulkan disabled was stable. Automatic
and software/Vulkan graphics crashed this emulator version on the host.

## Persistence in the actual Android app

The bundled SQLite implementation ran unchanged. Through the application UI:

1. Captured an Inbox item.
2. Created a Project with Area, description, next action, and dates.
3. Created an independent Win linked to the Project and Area.
4. Saved today's Daily Check-in.
5. Started a Weekly Review, saved two reflections, and advanced its saved step.
6. Force-stopped the process with ADB, confirmed it was gone, and relaunched.
7. Compared all five collections, review entries, IDs, timestamps, and values.
8. Edited the Project, Check-in, and Review after relaunch and verified saves.

All records survived. A read-only copy of the database and matching WAL/SHM
sidecars returned `integrity_check = ok`, no foreign-key violations, exactly one
applied migration (version 1), and nine default Areas. A live invalid-area Project
write was rejected with `FOREIGN KEY constraint failed` and created no row.
The private path was `/data/user/0/local.lifeos.client/life-os.sqlite3` with owner
read/write permissions. No Windows path or alternate Android data layer is used.

## Mobile interactions

Seven screens were exercised at actual emulator viewport widths 390, 360, and
320 CSS pixels. All fit without horizontal overflow; compact navigation fits
without horizontal scrolling. All visible buttons met the 48px touch minimum.
Project and Win forms fit each width and focus their first field. Screenshots
were inspected, including the 320px Project form.

Native keyboard and Back checks verified:

- The viewport shrinks above the keyboard and expands when it closes.
- Real Android text input and Enter capture an Inbox item.
- Project forms scroll to their actions above the open keyboard.
- Back first hides the keyboard, then closes a form; More also dismisses.
- Back from the review saves the draft before returning to Now.
- Home/backgrounding saves a pending review reflection; returning retains it.
- The native date picker selects October 2, 2026 and persists it to the Project.

The fixes are limited to insets/keyboard handling, Android Back/pause forwarding,
review pause saving, safe-area header height, and touch target sizes. The existing
bottom navigation and visual styling were retained. No WebView errors were
reported by the successful device checks.

## Existing verification and Windows regression

Prettier, strict TypeScript (including Vite configuration), frontend production
build, rustfmt, Cargo check, Clippy with warnings denied, and all seven existing
SQLite tests pass. No checks or tests were removed or weakened.

The Windows development app used its existing `local.lifeos.client.qa` database.
All five data types loaded; a Project edit saved through the UI. A complete native
close/restart retained every collection and edited value. The existing seven-screen
1100/390/320 layout checks, More/Escape behavior, and dialog focus checks also pass.

The normal Windows production executable built and launched at 1100×760 with
Vite stopped. Its existing private database passed read-only integrity and
foreign-key checks, retained migration 1, and contained all nine default Areas.

## Android builds

Android development automatically built, installed, and launched with Vite/HMR
using the then-documented explicit `--no-default-features` argument. Bundled debug
APK compilation passed. The optimized universal release APK also built for
ARM64 and x86_64 (15,714,167 bytes before signing). A local test copy signed with
the existing Android debug key installed over the development app and launched
successfully with Vite stopped; its native window was visually inspected.
The release artifact remains unsigned for distribution, and no production
signing key or credentials were added.

The final packaged debug APK was installed over the release test copy. A complete
snapshot comparison confirmed all data survived both package replacements.
Today's Check-in form and all ten Review steps then passed width checks at
390/360/320 pixels. After saving, another full force-stop/relaunch retained the
entire snapshot. The final app loaded embedded assets with Vite stopped and
reported no WebView errors. The full existing verification suite was rerun and
passed after these changes, including all seven SQLite tests.

## Artifacts and limitations

Local evidence, screenshots, test scripts, copied databases, and
signed test packages belong in ignored `.artifacts/`. Generated Android build
directories and glue are ignored separately; native project source is retained.
The original MVP branch remains at `8bf8876`.

## Reproducible developer setup cleanup

The original development example read a temporary pointer to the test JDK from
`.artifacts`. Normal commands now use only developer-supplied `JAVA_HOME`,
`ANDROID_HOME`, and `NDK_HOME`. The verification JDK was copied to a stable
per-user tools directory outside the repository; global environment settings
were not changed. No personal JDK path is committed.

`android:check` validates both Java executables as major 21 and checks the required
SDK/NDK components. npm runs it automatically before Android development/build.
Missing JAVA_HOME, invalid JAVA_HOME, Java 25, missing SDK, and invalid NDK were
rejected with actionable errors; JDK 21 was accepted. An Android npm build with
Java 25 stopped at preflight before Tauri ran.

The previous `--no-default-features` diagnosis was corrected. Development still
stalled with that flag while the headless emulator had been started with
`-no-boot-anim`: `sys.boot_completed` was `1`, but `init.svc.bootanim` was empty.
The Tauri runner waits for the latter to report `stopped`. Restarting the same
AVD with normal boot animation resolved the stall; the command without the extra
Cargo flag built, installed, launched, loaded Vite, and opened all five existing
data types. The updated guide explains this correction explicitly.

After cleanup, Android release compilation for ARM64/x86_64 passed with the
external JDK and automatic preflight. Windows development retained the saved QA
snapshot and passed existing seven-screen layout checks. The Windows production
build launched successfully; production and QA SQLite databases both passed
read-only integrity, foreign-key, migration, and seeded-Area checks. Formatting,
strict TypeScript, frontend build, rustfmt, Cargo check, Clippy, and all seven
SQLite tests passed. Staged-file review excluded all generated APKs, caches,
emulator output, test data, and signing material.
The final debug APK also built through preflight, installed over the existing
app, and launched with embedded assets and all five saved data types intact.

The test matrix covers one emulator/OS/WebView combination. Physical ARM64 phones,
older Android versions, OEM keyboards, release signing, and store installation
are not verified. See [Android commands and storage](ANDROID.md) for reproducible
development, build commands, emulator settings, and save/termination semantics.
