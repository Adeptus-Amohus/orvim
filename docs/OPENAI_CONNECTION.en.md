# Set up OpenAI in Orvim

English | [Русский](OPENAI_CONNECTION.md)

1. Create an API key for your project on the [OpenAI API keys page](https://platform.openai.com/api-keys).
2. In the installed Orvim app, open **Settings → Connections → AI assistant** and choose **OpenAI**.
3. Paste your API key and save it. The key field clears after a successful save. The status confirms the key is stored on the device. Set up each device separately. Backups and sync do not include keys.
4. Check the connection or load models, then choose an available text model. You can enter the exact API model name if you know it.
5. Open the AI assistant. Select the sections you want to share, enter a request, and send it. Review proposed changes before applying them.

The connection check fetches a model list. Your selected records are sent only when you submit a request to the assistant.

## Troubleshooting

- **401** usually means the key is invalid or revoked. Check it and save a valid key.
- **403** means the key or project lacks permission for the feature or model.
- **404** can indicate an incorrect model name. Refresh the models and select an available one.
- **429** can indicate rate or spending limits. Check [API billing](https://platform.openai.com/settings/organization/billing/overview) and your project’s limits.
- If you cannot connect, check the device’s internet connection. Use the installed APK or EXE to save credentials.

[Installation](INSTALLATION.en.md) · [Data and privacy](PRIVACY.en.md)
