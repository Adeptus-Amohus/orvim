export function installLicenseSettings(ctx, panel, ui) {
  const { make, action, services } = ctx,
    card = make("section", "settings-data-card"),
    form = ui.dialog("license-dialog", "Лицензии");
  const text = make("pre", "license-text");
  form.append(
    text,
    action(
      "Сохранить лицензии сторонних компонентов",
      async () => {
        try {
          const response = await fetch("/third-party-licenses.txt");
          if (!response.ok) throw Error("Файл лицензий не найден.");
          await services.saveFile(
            "Orvim-third-party-licenses.txt",
            "text/plain",
            await response.text(),
          );
        } catch (error) {
          form.append(make("p", "connection-status", String(error)));
        }
      },
      "button",
    ),
  );
  card.append(
    make("h3", "", "О приложении"),
    make(
      "p",
      "",
      "Orvim — личное пространство для планов, мыслей и повседневной жизни.",
    ),
    make(
      "p",
      "aux-note",
      "Расписание и задачи, проекты с материалами, заметки, коллекции книг и фильмов, сон, питание, тренировки и финансы собраны вместе. Записи хранятся на устройстве; синхронизация по Wi-Fi подключается отдельно.",
    ),
    make(
      "p",
      "aux-note",
      "ИИ-помощник работает через ваш API-ключ. Он получает выбранный контекст, предлагает изменения и применяет их после подтверждения.",
    ),
    make(
      "p",
      "aux-note",
      "Orvim · Apache-2.0 для собственного кода. Шрифты и сторонние компоненты сохраняют свои лицензии.",
    ),
    action(
      "Лицензии и уведомления",
      async () => {
        ctx.openDialog("license-dialog");
        text.textContent = "Загрузка…";
        try {
          const documents = await Promise.all(
            ["/LICENSE.txt", "/NOTICE.txt"].map(async (url) => {
              const response = await fetch(url);
              if (!response.ok) throw Error("Файл лицензии недоступен.");
              return response.text();
            }),
          );
          text.textContent = documents.join("\n\n");
        } catch (error) {
          text.textContent = String(error);
        }
        ctx.fitDialog();
      },
      "button",
    ),
  );
  panel.append(card);
}
