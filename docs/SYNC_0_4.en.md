# Sync and file transfers

English | [Русский](SYNC_0_4.md)

## Pair devices on your local network

1. Keep Orvim open on both devices. Connect them to the same trusted private network. The PC can use Ethernet while the phone uses Wi-Fi.
2. On the PC, open **Settings → Data** and create a connection.
3. On the phone, find devices, choose the PC, compare its identifier, and enter the one-time pairing code. Alternatively, scan the QR code with your phone camera and confirm the connection in Orvim. The code expires after five minutes. You can also enter the address manually.
4. If discovery fails, check whether guest Wi-Fi, client isolation, a VPN, or a firewall is blocking the connection. On Windows, allow Orvim on the private network. It uses TCP port 42673 and UDP port 42674.

## Review changes before applying them

Compare incoming additions, edits, and deletions with your local records. Select the changes you want to apply. If a task, event, thought, or material has a conflict, you can keep the local version as a separate copy. Orvim creates a backup before applying changes. Local settings, API keys, and appearance preferences stay on each device.

Pairing protects the exchange and the contents are encrypted. Network addresses and traffic timing are still visible to others on the network. Share pairing codes only between your own devices and revoke pairings you no longer use. Sync is available on a local network. Older WebDAV settings no longer sync records.

## Transfer records with a file

In **Settings → Data**, prepare a protected USB transfer file and save it outside Orvim’s private folder. Copy it to the other device, then open and merge it in Orvim. Transfer starts when you import the file. Matching records are merged by ID and conflicting versions are shown for review. Keep the transfer password separate from the file.

[Backups and recovery](BACKUPS.en.md) · [Data and privacy](PRIVACY.en.md)
