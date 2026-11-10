import {
  installSyncReview,
  syncConflictTitle,
  syncConflictValue,
} from "./sync-review.js";
import { parsePairingLink } from "./pairing.js";
export function installLanSettings(ctx, panel, ui) {
  const { make, listen, action, services } = ctx;
  Object.assign(ctx.translations, {
    Синхронизировать: "Sync now",
    "Параметры подключения": "Connection details",
    "Как подключить устройства?": "How do I connect my devices?",
    "Откройте Orvim на обоих устройствах для обмена.":
      "Keep Orvim open on both devices to sync.",
    "Пока нет подключённых устройств": "No connected devices yet",
    "Код для подключения · действует 5 минут":
      "Pairing code · valid for 5 minutes",
    "Подключите ПК и телефон к одному роутеру. На ПК нажмите «Добавить устройство», на телефоне — «Найти устройства» и введите код с ПК. Можно отсканировать QR-код камерой телефона.":
      "Connect both devices to the same router. On the PC, choose Add device; on the phone, choose Find devices and enter the code shown on the PC. You can also scan the QR code with the phone camera.",
    "Данные передаются по локальной сети в зашифрованном виде. Ключи API, оформление и уведомления остаются на каждом устройстве. Перед первым обменом сохраняется резервная копия.":
      "Data is encrypted during local network transfer. API keys, appearance and notifications stay on each device. A backup is saved before the first exchange.",
    "Синхронизация по сети": "Local network sync",
    "Оба устройства должны быть в одной сети Wi-Fi. На ПК создайте подключение, на телефоне введите адрес и код.":
      "Connect both devices to the same Wi-Fi. Create a connection on the PC, then enter its address and code on the phone.",
    "Создать подключение на ПК": "Create connection on PC",
    "Подключиться к ПК": "Connect to PC",
    "Подключено к ПК": "Connected to PC",
    "Адрес ПК": "PC address",
    "Код с ПК": "Code from PC",
    "Название устройства": "Device name",
    Телефон: "Phone",
    Подключить: "Connect",
    "Добавить устройство": "Add device",
    "Синхронизировать сейчас": "Sync now",
    "Отключить синхронизацию": "Disconnect sync",
    "Изменить адрес ПК": "Change PC address",
    "Синхронизация выключена": "Sync is off",
    "ПК принимает подключения": "PC accepts connections",
    "Подключённые устройства": "Connected devices",
    "Отозвать доступ": "Revoke access",
    "Одноразовый код · 5 минут": "One-time code · 5 minutes",
    "Обмен работает, пока Orvim открыт на обоих устройствах. В Windows разрешите доступ в частной сети.":
      "Keep Orvim open on both devices. Allow access on private networks in Windows.",
    "Без интернета. Ключи API, оформление и уведомления остаются на каждом устройстве. Перед первым обменом автоматически сохраняется резервная копия.":
      "No internet needed. API keys, appearance and notifications stay on each device. A backup is created before the first exchange.",
    "Доступно в установленном приложении Windows / Android.":
      "Available in the installed Windows / Android app.",
    "Проверяем подключение…": "Checking connection…",
    "Синхронизация…": "Syncing…",
    "Последний обмен": "Last sync",
    "Сеть недоступна. Изменения сохранены на устройстве.":
      "Network unavailable. Changes are saved on this device.",
    "Одновременные изменения": "Concurrent changes",
    "Оставить эту версию": "Keep this version",
    "Выбрать другую": "Choose alternative",
    "Удалить запись": "Delete record",
    "Сохранить запись": "Keep record",
    "Обе версии сохранены. Выберите нужную.":
      "Both versions are preserved. Choose one.",
    "Код истёк. Нажмите «Добавить устройство».":
      "Code expired. Click Add device.",
    "Ожидаем адрес локальной сети. Проверьте подключение ПК к Wi-Fi.":
      "Waiting for a local address. Check the PC's Wi-Fi connection.",
  });
  const card = make("section", "settings-data-card lan-card");
  card.id = "lan-settings";
  card.append(make("h3", "", "Синхронизация по сети"));
  const status = make("p", "connection-status", "Проверяем подключение…");
  status.id = "lan-status";
  status.setAttribute("role", "status");
  const error = make("p", "connection-status");
  error.id = "lan-error";
  error.setAttribute("role", "status");
  error.dataset.error = "true";
  const lastSync = make("span", "lan-last-sync"),
    statusBox = make("div", "lan-status-box"),
    statusDot = make("span", "lan-status-dot");
  statusDot.setAttribute("aria-hidden", "true");
  const statusCopy = make("div");
  statusCopy.append(status, lastSync);
  statusBox.append(statusDot, statusCopy);
  const off = make("div", "lan-off"),
    host = make("div", "lan-host"),
    client = make("div", "lan-client"),
    peers = make("div", "lan-peers"),
    conflicts = make("div", "lan-conflicts");
  let state = { mode: "off" },
    busy = false,
    pairingOverride = false;
  const review = installSyncReview(ctx, ui);
  let expectedId = "";
  function emit(operation, args = {}) {
    window.dispatchEvent(
      new CustomEvent("life-os:lan-action", { detail: { operation, args } }),
    );
  }
  const buttons = [];
  function button(text, operation, args, className = "button") {
    const b = action(
      text,
      () => emit(operation, typeof args === "function" ? args() : args || {}),
      className,
    );
    buttons.push(b);
    return b;
  }
  const hostButton = button("Создать подключение на ПК", "host");
  hostButton.id = "lan-host-start";
  hostButton.hidden = services.mobile === true;
  off.append(hostButton, make("h4", "", "Подключиться к ПК"));
  const scan = action(
    "Сканировать QR-код",
    async () => {
      scan.disabled = true;
      try {
        const result = await services.platform("scanPairingCode", {});
        if (result?.link) acceptPairingLink(result.link);
      } catch (problem) {
        error.hidden = false;
        error.textContent = String(problem);
      } finally {
        scan.disabled = false;
      }
    },
    "button button-primary",
  );
  scan.id = "lan-scan-qr";
  scan.hidden = services.mobile !== true;
  off.append(scan);
  function input(label, id, placeholder) {
    const field = make("label", "field", label),
      control = make("input");
    control.id = id;
    control.placeholder = placeholder || "";
    control.autocomplete = "off";
    field.append(control);
    return [field, control];
  }
  const [addressField, address] = input(
      "Адрес ПК",
      "lan-address",
      "192.168.1.12:42673",
    ),
    [codeField, code] = input("Код с ПК", "lan-code", "00000000"),
    [nameField, name] = input(
      "Название устройства",
      "lan-device-name",
      "Телефон",
    );
  address.spellcheck = false;
  code.inputMode = "numeric";
  code.maxLength = 8;
  name.maxLength = 60;
  listen(code, "input", () => {
    code.value = code.value.replace(/\D/g, "").slice(0, 8);
  });
  const fields = make("div", "lan-pair-fields");
  const manual = make("details"),
    devices = make("div", "lan-devices"),
    selected = make("p", "aux-note");
  manual.append(make("summary", "", "Ввести адрес вручную"), addressField);
  fields.append(manual, codeField, nameField);
  off.append(
    button("Найти устройства", "discover"),
    devices,
    selected,
    fields,
    button("Подключить", "pair", () => ({
      address: address.value.trim(),
      code: code.value.trim(),
      name: name.value.trim() || (services.mobile ? "Телефон" : "ПК"),
      expectedId,
    })),
  );
  const cancelPairing = action(
    "Оставить текущее подключение",
    () => {
      pairingOverride = false;
      render();
    },
    "text-button",
  );
  cancelPairing.hidden = true;
  off.append(cancelPairing);
  const addresses = make("div", "lan-addresses"),
    pairing = make("div", "lan-pair-code"),
    pairingLabel = make("span", "aux-note", "Одноразовый код · 5 минут"),
    pairingValue = make("strong");
  pairingValue.dataset.userContent = "";
  pairing.append(pairingLabel, pairingValue);
  const qr = make("img", "lan-qr"),
    hostIdentity = make("p", "aux-note");
  qr.alt = "QR-код сопряжения Orvim";
  const hostDetails = make("details", "settings-secondary lan-technical");
  let firewallChecked = false,
    firewallBusy = false;
  const networkNotice = make("div", "lan-network-notice"),
    firewallMessage = make("p", "aux-note"),
    firewallDetail = make("p", "aux-note");
  networkNotice.hidden = true;
  async function checkFirewall(repair = false) {
    if (
      services.mobile ||
      !services.platform ||
      !services.localSync ||
      firewallBusy
    )
      return;
    firewallChecked = true;
    firewallBusy = true;
    repairFirewall.disabled = true;
    try {
      const result = await services.platform(
        repair ? "lanFirewallRepair" : "lanFirewallStatus",
        {},
      );
      firewallDetail.textContent = result.message || "";
      networkNotice.hidden = !result.available || result.ready;
      firewallMessage.textContent =
        "Для подключения телефона разрешите Orvim в частной сети Windows. Появится системный запрос подтверждения.";
      if (repair && result.error) {
        networkNotice.hidden = false;
        firewallMessage.textContent = result.error;
      }
    } catch (problem) {
      firewallDetail.textContent = String(problem);
    } finally {
      firewallBusy = false;
      repairFirewall.disabled = false;
      ctx.fitDialog();
    }
  }
  const repairFirewall = action(
    "Разрешить доступ в Windows",
    () => checkFirewall(true),
    "button",
  );
  repairFirewall.id = "lan-firewall-repair";
  networkNotice.append(firewallMessage, repairFirewall);
  const checkWindows = action(
    "Проверить разрешения Windows",
    () => checkFirewall(),
    "text-button",
  );
  checkWindows.id = "lan-firewall-check";
  checkWindows.hidden = services.mobile === true || !services.localSync;
  hostDetails.append(
    make("summary", "", "Параметры подключения"),
    addresses,
    hostIdentity,
    checkWindows,
    firewallDetail,
  );
  const pairingBox = make("div", "lan-pairing-box");
  pairingBox.append(qr, pairing);
  host.append(pairingBox, peers);
  const remote = make("p", "aux-note");
  remote.dataset.userContent = "";
  const editAddress = make("details", "lan-address-edit");
  editAddress.append(make("summary", "", "Изменить адрес ПК"));
  const [newAddressField, newAddress] = input(
    "Адрес ПК",
    "lan-new-address",
    "192.168.1.12:42673",
  );
  editAddress.append(
    newAddressField,
    button("Сохранить", "address", () => ({
      address: newAddress.value.trim(),
    })),
  );
  client.append(remote, editAddress);
  const connectedActions = make("div", "connection-actions");
  const addDevice = button(
      "Добавить устройство",
      "host",
      {},
      "button button-primary",
    ),
    reviewButton = action("Сравнить изменения", () => review.open(), "button"),
    exchangeButton = button("Синхронизировать", "exchange"),
    stopButton = button("Отключить синхронизацию", "stop", {}, "text-button");
  addDevice.id = "lan-add-device";
  connectedActions.append(addDevice, exchangeButton, reviewButton);
  const help = make("details", "settings-secondary lan-help");
  help.append(
    make("summary", "", "Как подключить устройства?"),
    make(
      "p",
      "aux-note",
      "Подключите ПК и телефон к одному роутеру. На ПК нажмите «Добавить устройство», на телефоне — «Найти устройства» и введите код с ПК. Можно отсканировать QR-код камерой телефона.",
    ),
    make(
      "p",
      "aux-note",
      "Обмен работает, пока Orvim открыт на обоих устройствах. В Windows разрешите доступ в частной сети.",
    ),
    make(
      "p",
      "aux-note",
      "Данные передаются по локальной сети в зашифрованном виде. Ключи API, оформление и уведомления остаются на каждом устройстве. Перед первым обменом сохраняется резервная копия.",
    ),
  );
  hostDetails.append(stopButton);
  const clientOptions = make(
    "details",
    "settings-secondary lan-client-options",
  );
  clientOptions.append(
    make("summary", "", "Параметры подключения"),
    editAddress,
  );
  client.append(clientOptions);
  card.append(
    statusBox,
    networkNotice,
    error,
    off,
    host,
    client,
    connectedActions,
    conflicts,
    hostDetails,
    make(
      "p",
      "aux-note lan-open-note",
      "Откройте Orvim на обоих устройствах для обмена.",
    ),
    help,
  );
  panel.prepend(card);
  function render(detail = {}) {
    state = { ...state, ...detail };
    busy = Boolean(state.busy);
    if (state.mode === "host" && !firewallChecked) void checkFirewall();
    const available = services.localSync === true;
    if (state.paired) pairingOverride = false;
    off.hidden = (state.mode !== "off" && !pairingOverride) || !available;
    host.hidden = state.mode !== "host" || !available;
    client.hidden = state.mode !== "client" || pairingOverride || !available;
    cancelPairing.hidden = !pairingOverride || state.mode === "off";
    connectedActions.hidden =
      (state.mode === "off" && !state.review) || !available;
    addDevice.hidden = state.mode !== "host";
    exchangeButton.hidden = state.mode === "off";
    reviewButton.hidden = !state.review;
    hostDetails.hidden = state.mode !== "host" || !available;
    if (state.mode === "client") clientOptions.append(stopButton);
    else hostDetails.append(stopButton);
    statusBox.dataset.mode = !available ? "off" : state.mode;
    statusBox.dataset.busy = String(busy);
    status.textContent = !available
      ? "Доступно в установленном приложении Windows / Android."
      : busy
        ? "Синхронизация…"
        : state.mode === "host"
          ? "ПК принимает подключения"
          : state.mode === "client"
            ? "Подключено к ПК"
            : "Синхронизация выключена";
    lastSync.textContent = "";
    if (available && state.lastSync) {
      const time = new Date(state.lastSync).toLocaleTimeString(
        ctx.root.lang || "ru",
        { hour: "2-digit", minute: "2-digit" },
      );
      lastSync.append(
        make("span", "", "Последний обмен"),
        document.createTextNode(" · " + time),
      );
    }
    error.textContent = state.error || "";
    error.hidden = !state.error;
    if (detail.devices) {
      devices.replaceChildren();
      for (const device of detail.devices) {
        const b = action(
          device.name + " · " + device.address,
          () => {
            address.value = device.address;
            expectedId = device.id;
            selected.textContent =
              "Выбран ПК: " +
              device.name +
              " · " +
              device.id +
              ". Сравните идентификатор на ПК и введите его код.";
          },
          "button",
        );
        devices.append(b);
      }
      if (!detail.devices.length)
        devices.append(make("p", "aux-note", detail.message));
    }
    qr.hidden = !state.qr?.svg;
    if (state.qr?.svg)
      qr.src =
        "data:image/svg+xml;charset=utf-8," + encodeURIComponent(state.qr.svg);
    hostIdentity.textContent = state.id ? "Идентификатор ПК: " + state.id : "";
    addresses.replaceChildren();
    for (const ip of state.addresses || []) {
      const field = make("label", "field", "Адрес ПК"),
        control = make("input");
      control.value = ip + ":" + (state.port || 42673);
      control.readOnly = true;
      control.setAttribute("aria-label", "Адрес ПК");
      listen(control, "click", () => control.select());
      field.append(control);
      addresses.append(field);
    }
    if (state.mode === "host" && !state.addresses?.length)
      addresses.append(
        make(
          "p",
          "aux-note",
          "Ожидаем адрес локальной сети. Проверьте подключение ПК к Wi-Fi.",
        ),
      );
    const validCode = state.code && state.expires > Date.now();
    pairingBox.hidden = !validCode;
    qr.hidden = !validCode || !state.qr?.svg;
    pairingValue.textContent = validCode ? state.code : "";
    pairingLabel.textContent = "Код для подключения · действует 5 минут";
    peers.replaceChildren();
    peers.append(
      make(
        "p",
        "aux-note",
        state.peers?.length
          ? "Подключённые устройства"
          : "Пока нет подключённых устройств",
      ),
    );
    for (const peer of state.peers || []) {
      const row = make("div", "lan-peer"),
        label = make("span", "", peer.name);
      label.dataset.userContent = "";
      row.append(
        label,
        action(
          "Отозвать доступ",
          () => emit("revoke", { id: peer.id }),
          "text-button",
        ),
      );
      peers.append(row);
    }
    remote.textContent = [state.hostName, state.address]
      .filter(Boolean)
      .join(" · ");
    if (document.activeElement !== newAddress)
      newAddress.value = state.address || "";
    conflicts.replaceChildren();
    if (state.conflicts?.length) {
      conflicts.append(
        make("h4", "", "Различия между устройствами"),
        make(
          "p",
          "aux-note",
          "Выберите, какое значение использовать на обоих устройствах.",
        ),
      );
      for (const conflict of state.conflicts) {
        const row = make("div", "lan-conflict"),
          title = make("strong", "", syncConflictTitle(conflict));
        title.dataset.userContent = "";
        row.append(title);
        for (const [alternative, value] of [
          [false, conflict.kept],
          [true, conflict.alternative],
        ]) {
          const choice = make("div", "lan-conflict-choice"),
            text = make("span", "", syncConflictValue(conflict, value));
          text.dataset.userContent = "";
          const label =
            conflict.field === "_deleted"
              ? value === true
                ? "Удалить запись"
                : "Сохранить запись"
              : alternative
                ? "Выбрать другую"
                : "Оставить эту версию";
          choice.append(
            text,
            action(
              label,
              () => emit("resolve", { id: conflict.id, alternative }),
              "button",
            ),
          );
          row.append(choice);
        }
        conflicts.append(row);
      }
    }
    for (const b of card.querySelectorAll("button"))
      b.disabled = busy || !available;
    repairFirewall.disabled ||= firewallBusy;
    checkWindows.disabled ||= firewallBusy;
    if (state.paired) {
      code.value = "";
      state.paired = false;
    }
    ctx.fitDialog();
  }
  const update = (event) => render(event.detail);
  function acceptPairingLink(raw) {
    const candidate = parsePairingLink(raw);
    if (state.mode === "host")
      throw Error(
        "Откройте QR-код на телефоне, который подключаете к этому ПК.",
      );
    expectedId = candidate.expectedId;
    address.value = candidate.address;
    code.value = candidate.code;
    pairingOverride = state.mode === "client";
    selected.textContent =
      "Код считан. ПК: " + candidate.address + ". Нажмите «Подключить».";
    manual.open = true;
    render({ error: "" });
    ui.openDataSettings();
  }
  const pairingLink = (event) => {
    try {
      acceptPairingLink(event.detail?.link || event.detail);
    } catch {
      /* Untrusted deep links are ignored. */
    }
  };
  window.addEventListener("life-os:lan-status", update);
  window.addEventListener("life-os:pairing-link", pairingLink);
  if (services.mobile)
    services
      .platform?.("pairingLink")
      .then((value) => value?.link && pairingLink({ detail: value }))
      .catch(() => {});
  render();
  return {
    dispose: () => {
      window.removeEventListener("life-os:lan-status", update);
      window.removeEventListener("life-os:pairing-link", pairingLink);
      review.dispose();
    },
  };
}
