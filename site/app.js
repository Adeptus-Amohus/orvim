const LANG_STORAGE_KEY = "orvim_site_lang";

const TOUR_SLIDES = [
  {
    id: "home",
    ru: [
      "Главная",
      "Ваш день в одном окне",
      "Расписание и задачи рядом. Выберите день и отмечайте выполненные дела.",
      "Расписание и задачи на главной Orvim",
    ],
    en: [
      "Home",
      "Your day at a glance",
      "See your schedule and tasks together. Pick a date and check off tasks as you go.",
      "Schedule and tasks on Orvim Home",
    ],
  },
  {
    id: "life",
    ru: [
      "Жизнь",
      "Записи о повседневной жизни",
      "Отмечайте самочувствие, сон, питание и тренировки. Смотрите, как меняются ваши записи со временем.",
      "Раздел «Жизнь» с дневными записями и показателями",
    ],
    en: [
      "Life",
      "Keep track of daily life",
      "Log how you feel, your sleep, meals, and workouts. Look back at your records over time.",
      "Life screen with daily records and measurements",
    ],
  },
  {
    id: "thoughts",
    ru: [
      "Мысли",
      "Место для идей и заметок",
      "Запишите мысль отдельно от списка дел. Возвращайтесь к заметкам, когда захотите развить идею.",
      "Раздел «Мысли» со списком заметок",
    ],
    en: [
      "Thoughts",
      "A place for ideas and notes",
      "Capture a thought outside your task list. Come back to your notes when you want to develop an idea.",
      "Thoughts screen with a list of notes",
    ],
  },
  {
    id: "projects",
    ru: [
      "Проекты",
      "Всё по проекту рядом",
      "Описание, материалы и задачи собраны в одном месте. На доске видно, что запланировано, в работе или готово.",
      "Проект с описанием, материалами и доской задач",
    ],
    en: [
      "Projects",
      "Everything for a project in one place",
      "Keep the brief, reference materials, and tasks together. The board shows what’s planned, in progress, and done.",
      "Project with a description, materials, and a task board",
    ],
  },
  {
    id: "database",
    ru: [
      "База данных",
      "Собственные коллекции",
      "Собирайте книги, фильмы и другие записи в коллекции. Добавляйте статусы, оценки и заметки.",
      "База данных Orvim с коллекцией книг",
    ],
    en: [
      "Database",
      "Build your own collections",
      "Organize books, films, and other records into collections. Add statuses, ratings, and notes.",
      "Database screen with a book collection",
    ],
  },
];

const translations = {
  en: {
    // Shared & index.html
    doc_title: "Orvim — A Personal Space for Tasks and Daily Life",
    doc_desc:
      "Tasks, projects, thoughts, and personal logs in one local-first app for Windows and Android. Explore Orvim and help shape what comes next.",
    skip_link: "Skip to content",
    brand_aria: "Orvim — back to top",
    nav_aria: "Main navigation",
    nav_features: "Features",
    nav_privacy: "Your Data",
    nav_download: "Download",
    header_feedback: 'Send Feedback <span aria-hidden="true">↗</span>',
    hero_meaning: "— “the order of my life”",
    hero_cta_download: 'Download Orvim <span aria-hidden="true">↓</span>',
    hero_cta_tour: 'See Inside <span aria-hidden="true">↘</span>',
    principles_aria: "What you can do in Orvim",
    principle_tasks_title: "Tasks",
    principle_tasks_desc: "View your schedule and tasks for any selected day.",
    principle_thoughts_title: "Thoughts",
    principle_thoughts_desc:
      "Capture an idea the moment it strikes, and return to your project notes later.",
    principle_logs_title: "Personal Logs",
    principle_logs_desc:
      "Track sleep, nutrition, and well-being at your own pace.",
    tour_title: "Inside Orvim",
    tour_device_label: "Interface version",
    tour_mobile: "Mobile version",
    tour_desktop: "Desktop version",
    tour_prev: "Previous screen",
    tour_next: "Next screen",
    inspect_interface: 'Enlarge screenshot <span aria-hidden="true">↗</span>',
    image_note: "Interface preview",
    download_title: "Download Orvim",
    windows_detail: "Windows 10 or 11 · 64-bit (x64)",
    windows_step: "Run the EXE file and follow the installer steps.",
    android_detail: "Android 7 or later · ARM64",
    android_step: "Open the downloaded APK and install the app.",
    first_launch:
      "Once installed, open Orvim and add your first task on the home screen.",
    download_help_aria: "Download help",
    help_install: "Installation help",
    help_update: "Updating from an older version",
    whats_new: "Release notes",
    privacy_strip_title: "Your Records Stay on Your Device",
    privacy_strip_desc:
      "Core sections work without an account or internet connection. Connecting external services is always your choice.",
    privacy_strip_link: 'How data is stored <span aria-hidden="true">↗</span>',
    feedback_title: "Feedback",
    feedback_desc: "Share your thoughts on Orvim or ask a question by email.",
    feedback_email_btn: 'Email about Orvim <span aria-hidden="true">↗</span>',
    feedback_github_btn:
      'Report a bug on GitHub <span aria-hidden="true">↗</span>',
    feedback_email_note:
      'Email for feedback and questions: <a href="mailto:a.baimurzinov1@gmail.com">a.baimurzinov1@gmail.com</a>',
    feedback_github_note:
      "A GitHub account is required to submit an issue. Do not attach personal logs or data files.",
    footer_privacy: "Site Privacy",
    dialog_aria: "Enlarged interface screenshot",
    dialog_close_aria: "Close screenshot",
    dialog_zoom: "Zoom 2×",
    dialog_close: 'Close <span aria-hidden="true">×</span>',

    // help.html
    help_doc_title: "Installation and Updating — Orvim",
    help_doc_desc:
      "How to install Orvim on Windows and Android and transfer records when updating.",
    help_to_download: "Back to download",
    help_h1: "Installation and Updating",
    help_win_p:
      "Open the downloaded EXE and follow the installer steps. An internet connection may be required during the first installation to download Microsoft components.",
    help_win_warn_summary: "Windows shows a warning",
    help_win_warn_p:
      'The Orvim installer does not have a Windows digital signature, so the system may show an unknown publisher warning. Make sure the file was downloaded from the <a href="./#download">official Orvim page</a>. If the source of the file is unknown, download it again from the site.',
    help_android_p:
      "Open the downloaded APK. If your phone asks for permission to install from your browser or file manager, verify that you downloaded the file from the official Orvim website. Once installed, open the app.",
    help_update_h2: "Updating from an older version",
    help_update_p1:
      "Before updating, open “Settings → Data → Password-protected backup” in Orvim. Save the backup outside the app folder and verify that it restores properly. For a standard update, install the new release over the current one.",
    help_update_p2:
      "If the update check in Orvim 0.4.46 or 0.4.47 returns a 404 error, download the new package from the site and install it over your existing app. Starting with 0.4.48, update checks query public releases.",
    help_old_apk_h3: "If an older test APK is installed on Android",
    help_old_apk_p:
      "Test builds up to 0.4.45 inclusive are signed with a different key. Release builds starting from 0.4.46 cannot be installed over those test APKs. Uninstalling the old app may erase your records.",
    help_old_apk_li1:
      "In the old Orvim app, create a password-protected backup and save it outside the app folder. Keep a second copy on another storage medium and store the password separately.",
    help_old_apk_li2:
      "Test restoring the backup on another device or in a separate installation. Make sure records and covers persist after restarting. If you cannot verify the restore, keep the old installation intact.",
    help_old_apk_li3:
      "Only after verifying the backup, uninstall the test APK, install the new release, and restore your records from the backup. External connections and widgets will need to be configured again.",
    help_backup_note:
      "Internal automatic backups are tied to a specific installation. Use a separate password-protected backup to transfer data.",
    help_full_docs: "Detailed instructions and technical requirements",
    help_back_download: "Back to download",

    // privacy.html
    privacy_doc_title: "Site Privacy — Orvim",
    privacy_doc_desc:
      "What data the Orvim website uses and how it differs from data storage inside the app.",
    privacy_to_home: 'Home <span aria-hidden="true">↗</span>',
    privacy_eyebrow: "The website and the app are separate",
    privacy_h1: "Site Privacy",
    privacy_s1_h2: "What this page does",
    privacy_s1_p1:
      "The Orvim website is a static page hosted on GitHub Pages. Its code contains no analytics trackers, advertising scripts, personal data collection forms, or first-party cookies. Fonts and images are loaded from the same domain.",
    privacy_s1_p2:
      "The website has no access to the installed app's database. To display download links for releases, it reads a small release.json file from the same address.",
    privacy_s2_h2: "Hosting and external links",
    privacy_s2_p1:
      'GitHub hosts this site and may process technical request data, such as IP addresses, in accordance with its <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">privacy statement</a>. GitHub\'s terms apply when navigating to GitHub Issues or Releases.',
    privacy_s3_h2: "Feedback",
    privacy_s3_p1:
      "The “Email about Orvim” button opens a draft email in your mail client. You decide what to write and when to send it. Bug reports on GitHub are publicly visible. Do not attach your personal database, medical or financial records, passwords, keys, or screenshots containing someone else's data. Use fictional examples instead.",
    privacy_s4_h2: "App data",
    privacy_s4_p1:
      "Core Orvim data is stored locally on your device. In the installed app, the database and internal automatic backups are encrypted with a device key. Transferring or restoring data after reinstalling requires a separate password-protected backup; test restoring it beforehand.",
    privacy_s4_p2:
      "Standard JSON/CSV exports, separately saved attachments, and the browser preview remain unencrypted. Older external backups are not re-encrypted automatically. Securing your device and backup storage location remains essential.",
    privacy_s4_p3:
      "External connections are enabled strictly by user choice. When sending a message to an AI provider, your prompt, conversation, and selected context are transmitted; other integrations transmit only the data required for their respective actions. Third-party services are governed by their own privacy policies.",
    privacy_s4_p4:
      '<a href="https://github.com/Adeptus-Amohus/orvim/blob/main/docs/INSTALLATION.en.md">Installation, backups, and safely upgrading from an old APK</a>.',
    privacy_s4_p5: "Verified against Orvim 0.4.46. Updated: November 11, 2026.",
    privacy_back_home: 'Back to Orvim <span aria-hidden="true">↗</span>',
  },
};

// Cache original Russian content and media attributes before switching
const ruCache = {
  title: document.title,
  desc: document.querySelector('meta[name="description"]')?.content || "",
  text: new Map(),
  html: new Map(),
  aria: new Map(),
  alt: new Map(),
};

for (const el of document.querySelectorAll("[data-i18n]")) {
  ruCache.text.set(el.dataset.i18n, el.textContent);
}
for (const el of document.querySelectorAll("[data-i18n-html]")) {
  ruCache.html.set(el.dataset.i18nHtml, el.innerHTML);
}
for (const el of document.querySelectorAll("[data-i18n-aria]")) {
  ruCache.aria.set(el.dataset.i18nAria, el.getAttribute("aria-label") || "");
}
for (const el of document.querySelectorAll("[data-i18n-alt]")) {
  ruCache.alt.set(el.dataset.i18nAlt, el.getAttribute("alt") || "");
}

let currentReleaseVersion = "0.4.50";
let currentLang = "ru";

function detectInitialLanguage() {
  const requested = new URLSearchParams(window.location.search).get("lang");
  if (requested === "ru" || requested === "en") return requested;

  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === "ru" || saved === "en") return saved;
  } catch {
    // Ignore storage errors if blocked by browser privacy settings
  }
  const language = navigator.languages?.[0] || navigator.language;
  return /^ru(?:-|$)/i.test(language) ? "ru" : "en";
}

function updateReleaseTexts(lang) {
  const statusEl = document.getElementById("release-status");
  const winLink = document.getElementById("windows-download");
  const androidLink = document.getElementById("android-download");

  if (statusEl) {
    statusEl.textContent =
      lang === "en"
        ? `Stable release ${currentReleaseVersion}. Direct download, no sign-up required.`
        : `Стабильный выпуск ${currentReleaseVersion}. Скачивание без регистрации.`;
  }
  if (winLink) {
    winLink.textContent =
      lang === "en" ? "Download Windows EXE ↓" : "Скачать Windows EXE ↓";
  }
  if (androidLink) {
    androidLink.textContent =
      lang === "en" ? "Download Android APK ↓" : "Скачать Android APK ↓";
  }
}

function getPageDocKeys() {
  const path = window.location.pathname;
  if (path.endsWith("help.html")) {
    return { title: "help_doc_title", desc: "help_doc_desc" };
  }
  if (path.endsWith("privacy.html")) {
    return { title: "privacy_doc_title", desc: "privacy_doc_desc" };
  }
  return { title: "doc_title", desc: "doc_desc" };
}

function applyLanguage(lang) {
  currentLang = lang === "en" ? "en" : "ru";
  document.documentElement.lang = currentLang;

  const docKeys = getPageDocKeys();
  const descMeta = document.querySelector('meta[name="description"]');
  const ogLocale = document.querySelector('meta[property="og:locale"]');

  if (currentLang === "en") {
    if (translations.en[docKeys.title]) {
      document.title = translations.en[docKeys.title];
    }
    if (descMeta && translations.en[docKeys.desc]) {
      descMeta.content = translations.en[docKeys.desc];
    }
    if (ogLocale) ogLocale.content = "en_US";
  } else {
    document.title = ruCache.title;
    if (descMeta) descMeta.content = ruCache.desc;
    if (ogLocale) ogLocale.content = "ru_RU";
  }

  for (const el of document.querySelectorAll("[data-i18n]")) {
    const key = el.dataset.i18n;
    if (currentLang === "en" && translations.en[key] !== undefined) {
      el.textContent = translations.en[key];
    } else if (ruCache.text.has(key)) {
      el.textContent = ruCache.text.get(key);
    }
  }

  for (const el of document.querySelectorAll("[data-i18n-html]")) {
    const key = el.dataset.i18nHtml;
    if (currentLang === "en" && translations.en[key] !== undefined) {
      el.innerHTML = translations.en[key];
    } else if (ruCache.html.has(key)) {
      el.innerHTML = ruCache.html.get(key);
    }
  }

  for (const el of document.querySelectorAll("[data-i18n-aria]")) {
    const key = el.dataset.i18nAria;
    if (currentLang === "en" && translations.en[key] !== undefined) {
      el.setAttribute("aria-label", translations.en[key]);
    } else if (ruCache.aria.has(key)) {
      el.setAttribute("aria-label", ruCache.aria.get(key));
    }
  }

  for (const el of document.querySelectorAll("[data-i18n-alt]")) {
    const key = el.dataset.i18nAlt;
    if (currentLang === "en" && translations.en[key] !== undefined) {
      el.setAttribute("alt", translations.en[key]);
    } else if (ruCache.alt.has(key)) {
      el.setAttribute("alt", ruCache.alt.get(key));
    }
  }

  renderTour();
  updateReleaseTexts(currentLang);

  for (const link of document.querySelectorAll("a[data-en-href]")) {
    link.dataset.ruHref ??= link.getAttribute("href");
    link.href =
      currentLang === "en" ? link.dataset.enHref : link.dataset.ruHref;
  }

  // Preserve an explicit language choice through links between site pages.
  for (const link of document.querySelectorAll(
    'a[href^="./"], a[href^="help.html"], a[href^="privacy.html"]',
  )) {
    const path = link.getAttribute("href").split(/[?#]/)[0];
    const target = new URL(link.href);
    target.searchParams.set("lang", currentLang);
    link.setAttribute("href", path + target.search + target.hash);
  }

  const langBtn = document.getElementById("lang-toggle");
  if (langBtn) {
    langBtn.textContent = currentLang === "ru" ? "EN" : "RU";
    langBtn.setAttribute(
      "aria-label",
      currentLang === "ru"
        ? "Switch language to English"
        : "Переключить язык на русский",
    );
  }
}

const langToggleBtn = document.getElementById("lang-toggle");
if (langToggleBtn) {
  langToggleBtn.addEventListener("click", () => {
    const nextLang = currentLang === "ru" ? "en" : "ru";
    const url = new URL(window.location.href);
    url.searchParams.set("lang", nextLang);
    window.history.replaceState(null, "", url);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, nextLang);
    } catch {
      // Ignore storage errors if blocked
    }
    applyLanguage(nextLang);
  });
}

const tour = document.getElementById("tour-carousel");
let renderTour = () => {};

if (tour) {
  const devices = document.getElementById("tour-devices");
  const controls = document.getElementById("tour-controls");
  const title = document.getElementById("tour-slide-title");
  const description = document.getElementById("tour-slide-description");
  const status = document.getElementById("tour-status");
  const image = document.getElementById("tour-image");
  const stage = document.getElementById("tour-stage");
  const enlarge = document.getElementById("tour-enlarge");
  const narrow = window.matchMedia("(max-width: 740px)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let device = narrow.matches ? "mobile" : "desktop";
  let manualDevice = false;
  let index = 0;
  let animation;
  let touch;

  renderTour = () => {
    const slide = TOUR_SLIDES[index];
    const [name, heading, body, alt] = slide[currentLang];
    const mobile = device === "mobile";
    const suffix = currentLang === "en" ? "-en" : "";
    const asset = `assets/tour/${slide.id}-${device}${suffix}`;
    const src = `${asset}.webp`;
    const full = `${asset}-full.webp`;
    title.textContent = heading;
    description.textContent = body;
    status.textContent = `${name} · ${index + 1} / ${TOUR_SLIDES.length}`;
    image.alt = alt;
    image.width = mobile ? 390 : 1280;
    image.height = mobile ? 795 : 840;
    stage.dataset.device = device;
    if (image.getAttribute("src") !== src || !image.srcset) {
      image.sizes = mobile
        ? "auto, min(390px, calc(100vw - 52px))"
        : "auto, (max-width: 740px) calc(100vw - 74px), min(1146px, calc(100vw - 150px))";
      image.srcset = `${src} ${image.width}w, ${full} ${mobile ? 1080 : 2560}w`;
      image.src = src;
    }
    enlarge.href = full;
    devices.querySelector(`input[value="${device}"]`).checked = true;
  };

  function moveSlide(direction) {
    index = (index + direction + TOUR_SLIDES.length) % TOUR_SLIDES.length;
    animation?.cancel();
    renderTour();
    if (!reducedMotion.matches && stage.animate) {
      animation = stage.animate(
        [
          { transform: `translateX(${direction * 24}px)`, opacity: 0.55 },
          { transform: "none", opacity: 1 },
        ],
        { duration: 180, easing: "ease-out" },
      );
    }
  }

  devices.hidden = false;
  controls.hidden = false;
  devices.addEventListener("change", (event) => {
    manualDevice = true;
    device = event.target.value;
    renderTour();
  });
  narrow.addEventListener("change", (event) => {
    if (manualDevice) return;
    device = event.matches ? "mobile" : "desktop";
    renderTour();
  });
  document
    .getElementById("tour-prev")
    .addEventListener("click", () => moveSlide(-1));
  document
    .getElementById("tour-next")
    .addEventListener("click", () => moveSlide(1));
  tour.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    moveSlide(event.key === "ArrowLeft" ? -1 : 1);
  });
  stage.addEventListener(
    "touchstart",
    (event) => {
      touch = event.touches.length === 1 ? event.touches[0] : null;
    },
    { passive: true },
  );
  stage.addEventListener("touchcancel", () => {
    touch = null;
  });
  stage.addEventListener(
    "touchend",
    (event) => {
      if (!touch) return;
      const end = event.changedTouches[0];
      const distance = end.clientX - touch.clientX;
      const vertical = end.clientY - touch.clientY;
      touch = null;
      if (
        Math.abs(distance) < 45 ||
        Math.abs(distance) < Math.abs(vertical) * 1.4
      )
        return;
      moveSlide(distance < 0 ? 1 : -1);
    },
    { passive: true },
  );
}

applyLanguage(detectInitialLanguage());

const dialog = document.getElementById("image-dialog");
if (dialog && typeof dialog.showModal === "function") {
  let trigger;
  const zoom = document.getElementById("dialog-zoom");
  const frame = dialog.querySelector(".dialog-image-frame");
  zoom.addEventListener("click", () => {
    const on = dialog.toggleAttribute("data-zoomed");
    zoom.setAttribute("aria-pressed", String(on));
    if (!on) frame.scrollTo(0, 0);
  });
  for (const link of document.querySelectorAll(".enlarge")) {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      trigger = link;
      const target = document.getElementById("dialog-image");
      const preview = link.closest(".tour-panel").querySelector("img");
      target.src = link.href;
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
  dialog.addEventListener("close", () => {
    dialog.removeAttribute("data-zoomed");
    zoom.setAttribute("aria-pressed", "false");
    frame.scrollTo(0, 0);
    trigger?.focus();
  });
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
    for (const platform of ["windows", "android"]) {
      const link = document.getElementById(`${platform}-download`);
      if (link) link.href = release[platform];
    }
    currentReleaseVersion = release.version;
    updateReleaseTexts(currentLang);
    const releasesLink = document.getElementById("releases-link");
    if (releasesLink) releasesLink.href = release.notes;
  } catch {
    // The verified download links in HTML remain usable if JSON is unavailable.
  }
}
loadRelease();
