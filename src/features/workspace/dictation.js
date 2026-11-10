/** Recognition engine restarts are internal. Only the user's Stop ends a session. */
export function createDictation(options) {
  let active = false,
    disposed = false,
    recognition = null,
    timer = null,
    base = "",
    final = "",
    starting = false,
    run = 0;
  const report = (text, error = false, details = {}) => {
    if (!disposed) options.onStatus(text, active, error, details);
  };
  function setText(text) {
    if (disposed) return;
    const value = [base, text].filter(Boolean).join(" ");
    if (options.getText() !== value) options.setText(value);
  }
  async function poll(session) {
    if (!active || session !== run) return;
    try {
      const result = await options.services.platform("speechPoll", {});
      if (session !== run) return;
      final = result.text || "";
      setText([final, result.partial || ""].filter(Boolean).join(" "));
      if (result.active === false) {
        active = false;
        report(
          result.error || "Микрофон остановлен. Распознанный текст сохранён.",
          Boolean(result.error),
          result,
        );
        return;
      }
      if (result.error) {
        active = false;
        void options.services.platform("speechStop", {}).catch(() => {});
        report(result.error, true, result);
        return;
      }
      report(
        result.listening
          ? "Слушаю… Пауза не завершает диктовку."
          : "Жду продолжения речи…",
        false,
        result,
      );
      timer = setTimeout(() => void poll(session), 250);
    } catch (error) {
      active = false;
      report(
        "Диктовка прервана. Распознанный текст сохранён. " + String(error),
        true,
      );
    }
  }
  function browserCycle(session) {
    if (!active || session !== run) return;
    const Recognition =
      globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
    if (!Recognition) {
      active = false;
      report("Движок распознавания недоступен.", true);
      return;
    }
    recognition = new Recognition();
    recognition.lang =
      { ru: "ru-RU", en: "en-US" }[options.language()] || "ru-RU";
    recognition.continuous = true;
    recognition.interimResults = true;
    let cycleFinal = "",
      partial = "";
    recognition.onresult = (event) => {
      if (session !== run) return;
      cycleFinal = "";
      partial = "";
      for (let i = 0; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) cycleFinal += text + " ";
        else partial += text + " ";
      }
      setText(
        [final, cycleFinal.trim(), partial.trim()].filter(Boolean).join(" "),
      );
    };
    recognition.onerror = (event) => {
      if (
        ["not-allowed", "service-not-allowed", "audio-capture"].includes(
          event.error,
        )
      ) {
        active = false;
        report(
          "Микрофон недоступен: " +
            event.error +
            ". Распознанный текст сохранён.",
          true,
        );
      }
    };
    recognition.onend = () => {
      final = [final, cycleFinal.trim(), partial.trim()]
        .filter(Boolean)
        .join(" ");
      setText(final);
      if (active && session === run)
        timer = setTimeout(() => browserCycle(session), 350);
    };
    try {
      recognition.start();
      report("Слушаю… Остановите диктовку кнопкой.", false, {
        mode: "browser",
      });
    } catch (error) {
      active = false;
      report(String(error), true);
    }
  }
  return {
    get active() {
      return active || starting;
    },
    async start() {
      if (active || starting || disposed) return;
      starting = true;
      const session = ++run;
      base = options.getText();
      final = "";
      try {
        if (options.services.platform) {
          const result = await options.services.platform("speechStart", {
            language: options.language(),
            allowCloud: options.allowCloud(),
          });
          if (session !== run) {
            await options.services.platform("speechStop", {});
            return;
          }
          if (result?.error || result?.active === false) {
            active = false;
            report(result.error || "Не удалось начать диктовку.", true, result);
            return;
          }
          active = true;
          report("Микрофон включён.", false, result || {});
          void poll(session);
        } else {
          if (!options.allowCloud())
            throw Error(
              "Для браузерного движка явно разрешите передачу аудио облачной службе.",
            );
          active = true;
          browserCycle(session);
        }
      } catch (error) {
        active = false;
        report(String(error), true);
      } finally {
        starting = false;
      }
    },
    async stop() {
      if (!active && !starting) return;
      const stopped = ++run;
      active = false;
      starting = false;
      clearTimeout(timer);
      if (recognition) {
        recognition.onend = null;
        recognition.stop();
        recognition = null;
      } else if (options.services.platform) {
        try {
          const result = await options.services.platform("speechStop", {});
          if (stopped !== run) return;
          setText(
            [result.text || final, result.partial || ""]
              .filter(Boolean)
              .join(" "),
          );
        } catch (error) {
          if (stopped === run) report(String(error), true);
          return;
        }
      }
      if (stopped === run)
        report("Диктовка остановлена. Текст можно исправить.");
    },
    dispose() {
      disposed = true;
      void this.stop();
    },
  };
}
