const STORAGE_KEY = "orvim-lang";

const SCREENSHOT_EN_MAP = {
  "assets/home-desktop.jpg": "assets/home-desktop-en.jpg",
  "assets/projects-desktop.jpg": "assets/projects-desktop-en.jpg",
  "assets/home-mobile.jpg": "assets/home-mobile-en.jpg",
};

const EN_BY_KEY = {
  "skip.content": "Skip to content",
  "nav.features": "Features",
  "nav.data": "Your Data",
  "nav.download": "Download",
  "nav.feedback": "Send Feedback ↗",
  "hero.expansion": "Ordo vitae meae — “the order of my life”",
  "hero.download": "Download Orvim ↓",
  "hero.inside": "See Inside ↘",
  "principles.tasks.title": "Tasks",
  "principles.tasks.body": "View your schedule and tasks for any selected day.",
  "principles.thoughts.title": "Thoughts",
  "principles.thoughts.body":
    "Capture an idea the moment it strikes, and return to your project notes later.",
  "principles.logs.title": "Personal Logs",
  "principles.logs.body":
    "Track sleep, nutrition, and well-being at your own pace.",
  "tour.title": "Inside Orvim",
  "tour.tab.day": "Your Day",
  "tour.tab.projects": "Your Projects",
  "tour.tab.mobile": "Mobile View",
  "tour.day.title": "Your Day in One View",
  "tour.day.body":
    "Schedule and tasks side by side. Pick a day, plan what matters, and check off what you’ve done.",
  "tour.projects.title": "Everything for a Project in One Place",
  "tour.projects.body":
    "Project notes, reference materials, and tasks live together. You can also jot down standalone thoughts before they become a plan.",
  "tour.mobile.title": "Designed for Smaller Screens",
  "tour.mobile.body":
    "On Android, add home-screen widgets for your schedule, tasks, thoughts, and nutrition.",
  "tour.enlarge": "Inspect interface ↗",
  "tour.note": "Interface preview",
  "download.title": "Download Orvim",
  "download.windows.detail": "Windows 10 or 11 · 64-bit (x64)",
  "download.windows.step": "Run the EXE file and follow the installer steps.",
  "download.windows.cta": "Download Windows EXE ↓",
  "download.android.detail": "Android 7 or later · ARM64",
  "download.android.step": "Open the downloaded APK and install the app.",
  "download.android.cta": "Download Android APK ↓",
  "download.firstLaunch":
    "Once installed, open Orvim and add your first task on the home screen.",
  "download.help": "Installation help",
  "download.update": "Updating from an older version",
  "download.whatsNew": "Release notes",
  "privacy.title": "Your Records Stay on Your Device",
  "privacy.body":
    "Core sections work without an account or internet connection. Connecting external services is always your choice.",
  "privacy.link": "How data is stored ↗",
  "feedback.title": "Feedback",
  "feedback.body": "Share your thoughts on Orvim or ask a question by email.",
  "feedback.emailCta": "Email about Orvim ↗",
  "feedback.githubCta": "Report a bug on GitHub ↗",
  "footer.privacy": "Site Privacy",
  "dialog.close": "Close ×",
};

const EN_BY_RU_TEXT = new Map([
  ["К содержимому", "Skip to content"],
  ["Возможности", "Features"],
  ["Ваши данные", "Your Data"],
  ["Скачать", "Download"],
  ["Оставить отзыв ↗", "Send Feedback ↗"],
  ["Скачать Orvim ↓", "Download Orvim ↓"],
  ["Посмотреть внутри ↘", "See Inside ↘"],
  ["Дела", "Tasks"],
  [
    "Посмотрите расписание и задачи на выбранный день.",
    "View your schedule and tasks for any selected day.",
  ],
  ["Мысли", "Thoughts"],
  [
    "Запишите идею сразу. К материалам проекта можно вернуться позже.",
    "Capture an idea the moment it strikes, and return to your project notes later.",
  ],
  ["Личные записи", "Personal Logs"],
  [
    "Записывайте сон, питание и самочувствие в удобном для вас темпе.",
    "Track sleep, nutrition, and well-being at your own pace.",
  ],
  ["Внутри Orvim", "Inside Orvim"],
  ["Ваш день", "Your Day"],
  ["Ваши проекты", "Your Projects"],
  ["Мобильный экран", "Mobile View"],
  ["Ваш день в одном окне", "Your Day in One View"],
  [
    "Расписание и задачи рядом. Выберите день, запланируйте дело и отметьте то, что уже получилось.",
    "Schedule and tasks side by side. Pick a day, plan what matters, and check off what you’ve done.",
  ],
  ["Всё по проекту рядом", "Everything for a Project in One Place"],
  [
    "Описание, материалы и задачи проекта собраны вместе. Мысли можно записывать и отдельно, когда они ещё не стали планом.",
    "Project notes, reference materials, and tasks live together. You can also jot down standalone thoughts before they become a plan.",
  ],
  ["Интерфейс на небольшом экране", "Designed for Smaller Screens"],
  [
    "На Android можно добавить на главный экран телефона виджеты расписания, задач, мыслей и питания.",
    "On Android, add home-screen widgets for your schedule, tasks, thoughts, and nutrition.",
  ],
  ["Рассмотреть интерфейс ↗", "Inspect interface ↗"],
  ["Пример интерфейса", "Interface preview"],
  ["Скачать Orvim", "Download Orvim"],
  [
    "Windows 10 или 11 · 64-разрядная система (x64)",
    "Windows 10 or 11 · 64-bit (x64)",
  ],
  [
    "Откройте EXE и следуйте шагам установщика.",
    "Run the EXE file and follow the installer steps.",
  ],
  ["Скачать Windows EXE ↓", "Download Windows EXE ↓"],
  ["Android 7 или новее · ARM64", "Android 7 or later · ARM64"],
  [
    "Откройте скачанный APK и установите приложение.",
    "Open the downloaded APK and install the app.",
  ],
  ["Скачать Android APK ↓", "Download Android APK ↓"],
  [
    "После установки откройте Orvim и добавьте первую задачу на главной.",
    "Once installed, open Orvim and add your first task on the home screen.",
  ],
  ["Помощь при установке", "Installation help"],
  ["Обновление со старой версии", "Updating from an older version"],
  ["Что нового", "Release notes"],
  ["Ваши записи на вашем устройстве", "Your Records Stay on Your Device"],
  [
    "Для основных разделов не нужны аккаунт и интернет. Подключение внешних сервисов остаётся за вами.",
    "Core sections work without an account or internet connection. Connecting external services is always your choice.",
  ],
  ["Как хранятся данные ↗", "How data is stored ↗"],
  ["Обратная связь", "Feedback"],
  [
    "Поделитесь впечатлениями об Orvim или задайте вопрос по почте.",
    "Share your thoughts on Orvim or ask a question by email.",
  ],
  ["Написать об Orvim ↗", "Email about Orvim ↗"],
  ["Сообщить об ошибке на GitHub ↗", "Report a bug on GitHub ↗"],
  [
    "Для публикации ошибки нужен аккаунт GitHub. Не прикладывайте личные записи и файлы с данными.",
    "A GitHub account is required to submit an issue. Do not attach personal logs or data files.",
  ],
  ["Приватность сайта", "Site Privacy"],
  ["Закрыть ×", "Close ×"],
  ["К скачиванию", "Back to download"],
  ["На главную ↗", "Home ↗"],
  ["Установка и обновление", "Installation and Updating"],
  ["Вернуться к скачиванию", "Back to download"],
  ["Вернуться к Orvim ↗", "Back to Orvim ↗"],
]);

const EN_ALT_BY_RU = new Map([
  [
    "Расписание и задачи на главной Orvim",
    "Schedule and tasks on the Orvim home screen",
  ],
  [
    "Проект в Orvim с описанием, материалами и задачами",
    "Project view in Orvim with description, materials, and tasks",
  ],
  [
    "Мобильная компоновка главной Orvim",
    "Mobile home screen layout in Orvim",
  ],
]);

let currentLang = "ru";
let latestReleaseVersion = "0.4.48";

function normalizeSpace(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function snapshotOriginals() {
  document.title && (document.documentElement.dataset.ruTitle = document.title);

  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc && !metaDesc.dataset.ruContent) {
    metaDesc.dataset.ruContent = metaDesc.getAttribute("content") || "";
  }

  for (const el of document.querySelectorAll(
    "a, button, h1, h2, h3, p, span, summary, li, [data-i18n], [data-i18n-html]"
  )) {
    if (!el.dataset.ruHtml) {
      el.dataset.ruHtml = el.innerHTML;
    }
  }

  for (const img of document.querySelectorAll("img")) {
    if (!img.dataset.ruSrc && img.getAttribute("src")) {
      img.dataset.ruSrc = img.getAttribute("src");
    }
    if (!img.dataset.ruAlt && img.hasAttribute("alt")) {
      img.dataset.ruAlt = img.getAttribute("alt") || "";
    }
  }

  for (const source of document.querySelectorAll("picture source")) {
    if (!source.dataset.ruSrcset && source.getAttribute("srcset")) {
      source.dataset.ruSrcset = source.getAttribute("srcset");
    }
  }

  for (const link of document.querySelectorAll("a.enlarge")) {
    if (!link.dataset.ruHref && link.getAttribute("href")) {
      link.dataset.ruHref = link.getAttribute("href");
    }
  }
}

function updateScreenshots(lang) {
  const isEn = lang === "en";

  for (const img of document.querySelectorAll("img[data-ru-src]")) {
    const ruSrc = img.dataset.ruSrc;
    const enSrc = SCREENSHOT_EN_MAP[ruSrc];
    if (enSrc) {
      if (isEn) {
        img.onerror = () => {
          img.onerror = null;
          img.src = ruSrc;
        };
        img.src = enSrc;
      } else {
        img.onerror = null;
        img.src = ruSrc;
      }
    }

    const ruAlt = img.dataset.ruAlt || "";
    if (isEn && EN_ALT_BY_RU.has(ruAlt)) {
      img.alt = EN_ALT_BY_RU.get(ruAlt);
    } else if (!isEn) {
      img.alt = ruAlt;
    }
  }

  for (const source of document.querySelectorAll("picture source[data-ru-srcset]")) {
    const ruSrcset = source.dataset.ruSrcset;
    const enSrcset = SCREENSHOT_EN_MAP[ruSrcset];
    if (enSrcset) {
      source.srcset = isEn ? enSrcset : ruSrcset;
    }
  }

  for (const link of document.querySelectorAll("a.enlarge[data-ru-href]")) {
    const ruHref = link.dataset.ruHref;
    const enHref = SCREENSHOT_EN_MAP[ruHref];
    if (enHref) {
      link.href = isEn ? enHref : ruHref;
    }
  }
}

function updateReleaseStatusText() {
  const statusEl = document.getElementById("release-status");
  if (!statusEl) return;
  statusEl.textContent =
    currentLang === "en"
      ? `Stable release ${latestReleaseVersion}. Direct download, no sign-up required.`
      : `Стабильный выпуск ${latestReleaseVersion}. Скачивание без регистрации.`;
}

function updateLangToggle() {
  const toggleBtn = document.getElementById("lang-toggle");
  if (!toggleBtn) return;
  // The button shows the language that a click will switch to.
  toggleBtn.textContent = currentLang === "en" ? "RU" : "EN";
  toggleBtn.setAttribute(
    "aria-label",
    currentLang === "en" ? "Переключить на русский" : "Switch to English"
  );
}

function applyLanguage(lang) {
  currentLang = lang === "en" ? "en" : "ru";
  document.documentElement.lang = currentLang;
  try {
    localStorage.setItem(STORAGE_KEY, currentLang);
  } catch {
    // Ignore storage restrictions in private browsing modes.
  }

  const metaDesc = document.querySelector('meta[name="description"]');

  if (currentLang === "ru") {
    if (document.documentElement.dataset.ruTitle) {
      document.title = document.documentElement.dataset.ruTitle;
    }
    if (metaDesc && metaDesc.dataset.ruContent) {
      metaDesc.setAttribute("content", metaDesc.dataset.ruContent);
    }
    for (const el of document.querySelectorAll("[data-ru-html]")) {
      if (el.id === "release-status") continue;
      el.innerHTML = el.dataset.ruHtml;
    }
  } else {
    if (document.title.includes("Orvim")) {
      if (location.pathname.endsWith("help.html")) {
        document.title = "Installation and Updating — Orvim";
      } else if (location.pathname.endsWith("privacy.html")) {
        document.title = "Site Privacy — Orvim";
      } else {
        document.title = "Orvim — A Personal Space for Tasks and Daily Life";
      }
    }
    if (metaDesc) {
      metaDesc.setAttribute(
        "content",
        "Tasks, projects, thoughts, and personal logs in one local-first app for Windows and Android. Explore Orvim and help shape what comes next."
      );
    }

    const expansion = document.querySelector(".hero-expansion");
    if (expansion) {
      expansion.innerHTML =
        '<span lang="la">Ordo vitae meae</span> <span>— “the order of my life”</span>';
    }

    const finePrints = document.querySelectorAll(".feedback .fine-print");
    if (finePrints[0]) {
      finePrints[0].innerHTML =
        'Email for feedback and questions: <a href="mailto:a.baimurzinov1@gmail.com">a.baimurzinov1@gmail.com</a>';
    }

    for (const el of document.querySelectorAll("[data-ru-html]")) {
      if (
        el.id === "release-status" ||
        el.classList.contains("hero-expansion") ||
        el === finePrints[0]
      ) {
        continue;
      }

      const key = el.getAttribute("data-i18n") || el.getAttribute("data-i18n-html");
      if (key && EN_BY_KEY[key]) {
        el.textContent = EN_BY_KEY[key];
        continue;
      }

      const cleanRu = normalizeSpace(el.textContent);
      if (EN_BY_RU_TEXT.has(cleanRu)) {
        el.textContent = EN_BY_RU_TEXT.get(cleanRu);
      }
    }
  }

  updateScreenshots(currentLang);
  updateReleaseStatusText();
  updateLangToggle();

  for (const btn of document.querySelectorAll(
    "[data-lang], [data-set-lang], #lang-ru, #lang-en, .lang-switch button, .lang-switcher button"
  )) {
    const btnLang = (
      btn.dataset.lang ||
      btn.dataset.setLang ||
      btn.id.replace("lang-", "") ||
      btn.textContent
    )
      .trim()
      .toLowerCase();
    if (btnLang === "ru" || btnLang === "en") {
      const active = btnLang === currentLang;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", String(active));
    }
  }
}

// Saved choice wins; otherwise use the browser language (English -> "en", anything else -> "ru").
function detectLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "ru") return saved;
  } catch {
    // Ignore storage restrictions in private browsing modes.
  }
  const preferred =
    (navigator.languages && navigator.languages[0]) ||
    navigator.language ||
    "ru";
  return String(preferred).toLowerCase().startsWith("en") ? "en" : "ru";
}

function initLanguageSwitcher() {
  snapshotOriginals();

  for (const btn of document.querySelectorAll(
    "[data-lang], [data-set-lang], #lang-ru, #lang-en, .lang-switch button, .lang-switcher button"
  )) {
    // The single RU/EN toggle button is handled separately below.
    if (btn.id === "lang-toggle") continue;
    const btnLang = (
      btn.dataset.lang ||
      btn.dataset.setLang ||
      btn.id.replace("lang-", "") ||
      btn.textContent
    )
      .trim()
      .toLowerCase();
    if (btnLang === "ru" || btnLang === "en") {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        applyLanguage(btnLang);
      });
    }
  }

  const toggle = document.getElementById("lang-toggle");
  if (toggle) {
    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      applyLanguage(currentLang === "en" ? "ru" : "en");
    });
  }

  applyLanguage(detectLanguage());
}

const tabs = [...document.querySelectorAll('[role="tab"]')];
function selectTab(tab) {
  for (const item of tabs) {
    const selected = item === tab;
    item.setAttribute("aria-selected", String(selected));
    item.tabIndex = selected ? 0 : -1;
    item.classList.toggle("active", selected);
    document.getElementById(item.getAttribute("aria-controls")).hidden =
      !selected;
  }
}
for (const [index, tab] of tabs.entries()) {
  tab.addEventListener("click", () => selectTab(tab));
  tab.addEventListener("keydown", (event) => {
    let next;
    if (event.key === "ArrowRight") next = tabs[(index + 1) % tabs.length];
    if (event.key === "ArrowLeft")
      next = tabs[(index + tabs.length - 1) % tabs.length];
    if (event.key === "Home") next = tabs[0];
    if (event.key === "End") next = tabs[tabs.length - 1];
    if (!next) return;
    event.preventDefault();
    selectTab(next);
    next.focus();
  });
}

const dialog = document.getElementById("image-dialog");
if (dialog && typeof dialog.showModal === "function") {
  let trigger;
  for (const link of document.querySelectorAll(".enlarge")) {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      trigger = link;
      const target = document.getElementById("dialog-image");
      const preview = link.closest(".tour-panel").querySelector("img");
      target.src = preview.currentSrc || preview.src || link.href;
      target.alt = preview.alt;
      dialog.showModal();
      dialog.querySelector("button").focus();
    });
  }
  dialog
    .querySelector("button")
    .addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    const bounds = dialog.getBoundingClientRect();
    if (
      event.target === dialog &&
      (event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom)
    )
      dialog.close();
  });
  dialog.addEventListener("close", () => trigger?.focus());
}

// Only explicit, verified public release links are enabled. No requests to a third-party API.
async function loadRelease() {
  if (!document.getElementById("release-status")) return;
  try {
    const response = await fetch("release.json");
    if (!response.ok) return;
    const release = await response.json();
    const isReleaseUrl = (value) => {
      try {
        const url = new URL(value);
        return (
          url.protocol === "https:" &&
          url.hostname === "github.com" &&
          url.pathname.startsWith("/Adeptus-Amohus/orvim/releases/") &&
          !url.username &&
          !url.password
        );
      } catch {
        return false;
      }
    };
    if (
      !release.version ||
      !isReleaseUrl(release.notes) ||
      !isReleaseUrl(release.windows) ||
      !isReleaseUrl(release.android)
    )
      return;
    latestReleaseVersion = release.version;
    for (const platform of ["windows", "android"]) {
      const link = document.getElementById(`${platform}-download`);
      link.href = release[platform];
      const ruLabel =
        platform === "windows"
          ? "Скачать Windows EXE ↓"
          : "Скачать Android APK ↓";
      const enLabel =
        platform === "windows"
          ? "Download Windows EXE ↓"
          : "Download Android APK ↓";
      link.dataset.ruHtml = ruLabel;
      link.textContent = currentLang === "en" ? enLabel : ruLabel;
    }
    updateReleaseStatusText();
    document.getElementById("releases-link").href = release.notes;
  } catch {
    // The verified download links in HTML remain usable if JSON is unavailable.
  }
}

initLanguageSwitcher();
loadRelease();
