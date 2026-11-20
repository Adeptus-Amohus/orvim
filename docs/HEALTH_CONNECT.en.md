# Health Connect on Android

English | [Русский](HEALTH_CONNECT.md)

Health Connect is built into Android 14 and later. On Android 9–13, install it from Google Play. It requires Google Play Services and is unavailable in Android work profiles. Your watch or fitness app must be able to share the categories you want to import, such as steps, sleep, or workouts. See [Google’s device requirements](https://developer.android.com/health-and-fitness/health-connect/availability).

## Connect and import

1. Set up your watch in its companion app and enable sharing to Health Connect.
2. In the installed Orvim app, open **Settings → Connections → Phone and watch**. You can also reach this screen from the workout section.
3. Choose the categories you want to import, then grant read access in the Android permission dialog.
4. Find steps and workouts under **Life → Workouts** and sleep in the sleep log. To combine an imported workout with a planned workout on the same day, use the imported workout’s menu to link it to the plan.

Orvim reads up to 30 days of data when you open or return to the app, and every five minutes while it is open. It keeps previously imported history. Manual sleep and step records take priority. Orvim merges matching imported workouts and keeps user edits and plan links. Removing data in Health Connect does not remove history already saved by Orvim.

## Stop importing

Turn off import in Orvim to stop reading Health Connect while keeping your history. To revoke access, open Android permissions from the connection screen. Imported records are stored in the local encrypted database and can be included in backups and selected transfers. You can enter records manually on devices without Health Connect.

[Data and privacy](PRIVACY.en.md) · [Backups and recovery](BACKUPS.en.md)
