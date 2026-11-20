# Contributing to Orvim

English | [Русский](CONTRIBUTING.md)

Start with the [Orvim overview](README.md), then see the [development guide (Russian)](docs/DEVELOPMENT.md) and [architecture (Russian)](docs/ARCHITECTURE.md) if you want to work on the code. The project has no guaranteed support response times.

## Feedback and bug reports

- [Email the maintainer](mailto:a.baimurzinov1@gmail.com) if you have a question, an idea, or feedback about how Orvim works for you. A GitHub account is unnecessary for email.
- If you can reproduce a bug, [open a GitHub issue](https://github.com/Adeptus-Amohus/orvim/issues/new?template=bug.yml). Sign in to GitHub, then include your Orvim version, device and OS version, the steps to reproduce the problem, what you expected, and what happened. The template is in Russian and you can write your report in English.
- Use sample records in public reports and screenshots. Keep personal data, database backups, and credentials private. For security issues, follow the [private reporting instructions](SECURITY.en.md#reporting-a-vulnerability).

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
