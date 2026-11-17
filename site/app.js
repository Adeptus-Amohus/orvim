const LANG_STORAGE_KEY = "orvim_site_lang";

const SCREENSHOT_EN_MAP = {
  "assets/home-desktop.jpg": "assets/home-desktop-en.jpg",
  "assets/projects-desktop.jpg": "assets/projects-desktop-en.jpg",
  "assets/home-mobile.jpg": "assets/home-mobile-en.jpg",
};

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
    tour_tabs_aria: "App screens",
    tab_day: "Your Day",
    tab_projects: "Your Projects",
    tab_mobile: "Mobile View",
    panel_day_title: "Your Day in One View",
    panel_day_desc:
      "Schedule and tasks side by side. Pick a day, plan what matters, and check off what you’ve done.",
    inspect_interface: 'Inspect interface <span aria-hidden="true">↗</span>',
    panel_day_alt: "Schedule and tasks on the Orvim home screen",
    panel_projects_title: "Everything for a Project in One Place",
    panel_projects_desc:
      "Project notes, reference materials, and tasks live together. You can also jot down standalone thoughts before they become a plan.",
    panel_projects_alt:
      "Project view in Orvim with description, materials, and tasks",
    panel_mobile_title: "Designed for Smaller Screens",
    panel_mobile_desc:
      "On Android, add home-screen widgets for your schedule, tasks, thoughts, and nutrition.",
    panel_mobile_alt: "Mobile home screen layout in Orvim",
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
    privacy_strip_link:
      'How data is stored <span aria-hidden="true">↗</span>',
    feedback_title: "Feedback",
    feedback_desc:
      "Share your thoughts on Orvim or ask a question by email.",
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
      '<a href="https://github.com/Adeptus-Amohus/orvim/blob/main/docs/INSTALLATION.md">Installation, backups, and safely upgrading from an old APK</a>.',
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

for (const img of document.querySelectorAll("img")) {
  if (!img.dataset.ruSrc && img.getAttribute("src")) {
    img.dataset.ruSrc = img.getAttribute("src");
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

let currentReleaseVersion = "0.4.48";
let currentLang = "ru";

function detectInitialLanguage() {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === "ru" || saved === "en") return saved;
  } catch {
    // Ignore storage errors if blocked by browser privacy settings
  }
  const browserLangs = navigator.languages?.length
    ? navigator.languages
    : [navigator.language || ""];
  const prefersRussian = browserLangs.some((code) =>
    String(code).toLowerCase().startsWith("ru"),
  );
  return prefersRussian ? "ru" : "en";
}

function updateScreenshots(lang) {
  const isEn = lang === "en";

  for (const source of document.querySelectorAll("picture source[data-ru-srcset]")) {
    const ruSrcset = source.dataset.ruSrcset;
    const enSrcset = SCREENSHOT_EN_MAP[ruSrcset];
    if (enSrcset) {
      source.srcset = isEn ? enSrcset : ruSrcset;
    }
  }

  for (const img of document.querySelectorAll("img[data-ru-src]")) {
    const ruSrc = img.dataset.ruSrc;
    const enSrc = SCREENSHOT_EN_MAP[ruSrc];
    if (!enSrc) continue;

    if (isEn) {
      img.onerror = () => {
        img.onerror = null;
        img.src = ruSrc;
        const picture = img.closest("picture");
        if (picture) {
          for (const source of picture.querySelectorAll("source[data-ru-srcset]")) {
            source.srcset = source.dataset.ruSrcset;
          }
        }
      };
      img.src = enSrc;
    } else {
      img.onerror = null;
      img.src = ruSrc;
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

  updateScreenshots(currentLang);
  updateReleaseTexts(currentLang);

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
    try {
      localStorage.setItem(LANG_STORAGE_KEY, nextLang);
    } catch {
      // Ignore storage errors if blocked
    }
    applyLanguage(nextLang);
  });
}

applyLanguage(detectInitialLanguage());

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
