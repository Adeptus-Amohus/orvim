# MVP verification

Date: 2026-09-21. Branch: `feature/life-os-mvp`, based on foundation checkpoint
`aaa15a7`.

## Environment

Windows x64 build 26200, Node 24.21.0, npm 11.19.0, Rust/Cargo 1.98.1,
Visual Studio Build Tools 2026, Windows SDK 10.0.26100.0, WebView2 153.0.4234.48.

## Automated checks

- Prettier formatting and strict frontend/build-configuration TypeScript pass.
- Vite production build passes.
- rustfmt and Clippy with warnings denied pass.
- All seven file-based SQLite tests pass.
- Rust tests create unique temporary databases and remove only their own test directories.

The tests cover migration rollback, idempotent defaults, newer-schema refusal,
foreign keys and invalid writes, update identity preservation, status transitions,
one check-in per date, separate Wins, and unfinished/completed review behavior.

## Native interaction and restart checks

The actual Windows Tauri app was exercised through its WebView2 controls using a
temporary QA identifier (`local.lifeos.client.qa`). Test data stays separate from
the normal `local.lifeos.client` workspace.

Verified through UI interactions:

- Enter capture; process, restore, and delete inbox items.
- Create/edit projects; pause and view in Someday; archive and reactivate.
- Record a Win; display its month group and monthly count.
- Create and edit a check-in while retaining one row and the same UUID.
- Create, complete, and reopen an action; completing it does not create a Win.
- Enter reflections, navigate review steps, choose three focuses, save for later,
  resume at the same step, complete the review, and view it read-only.

A native window close and full application restart preserved the same Inbox,
Project, Win, Check-in, and Review UUIDs and their values. A reflection edited
immediately before close was also persisted by the save-before-close handler.

All seven screens were checked at 1100px, 390px, and 320px. Project/Win dialogs
fit narrow widths; dialogs focus their first input. The compact More menu and
Escape dismissal work without horizontal navigation scrolling. Light and dark
themes were visually inspected. The final QA WebView checks reported no errors.

Screenshots and local QA scripts are in ignored `.artifacts/`; they are not runtime
dependencies or committed product data.

## Production build

The normal Windows release build completed and launched successfully with Vite
stopped and no debugging port open. It embeds the frontend and uses
`local.lifeos.client`. The native window was visually checked at 1100×760,
390×760, and 320×640, then restored to desktop size and left open.

The production SQLite file was created in the expected application-local
directory. Read-only inspection confirmed migration 1, all eight domain tables,
the migration ledger, and all nine default Areas. `PRAGMA integrity_check`
returned `ok`. QA records did not appear in the production workspace.
MSI/NSIS installers, signing, and Android builds are outside this milestone.

Rust 1.98 reports the localized MSVC message about generating library/export
files as a linker-output warning. It is informational; formatting, Clippy, tests,
and compilation complete successfully.
