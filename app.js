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
      target.src = link.href;
      target.alt = link.closest(".tour-panel").querySelector("img").alt;
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
      link.href = release[platform];
      link.textContent =
        platform === "windows" ? "Скачать для Windows ↓" : "Скачать APK ↓";
      document.getElementById(`${platform}-detail`).textContent +=
        ` · ${release.version}`;
    }
    document.getElementById("release-status").textContent =
      `Открытая тестовая версия ${release.version}. Выберите своё устройство. Перед обновлением создайте резервную копию.`;
    document.getElementById("releases-link").href = release.notes;
    document.getElementById("release-note").textContent =
      release.notice ||
      "Файлы размещены в официальном репозитории Orvim. Условия и известные ограничения — в описании выпуска.";
  } catch {
    // The static request-build links remain usable offline or on a failed request.
  }
}
loadRelease();
