// QR codes fill a form only. Pairing still needs a deliberate confirmation.
export function parsePairingLink(raw) {
  const invalid = () =>
    Error("Это не QR-код подключения Orvim. Откройте код в настройках на ПК.");
  if (typeof raw !== "string" || raw.length > 2048) throw invalid();
  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    throw invalid();
  }
  if (
    !["lifeos:", "orvim:"].includes(url.protocol) ||
    url.hostname !== "pair" ||
    !["", "/"].includes(url.pathname) ||
    url.username ||
    url.password ||
    url.port ||
    url.hash
  )
    throw invalid();
  const id = url.searchParams.get("id"),
    code = url.searchParams.get("code"),
    address = url.searchParams.get("address");
  if (
    !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(
      id || "",
    ) ||
    !/^\d{8}$/.test(code || "")
  )
    throw invalid();
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?::42673)?$/.exec(
    address || "",
  );
  if (!match) throw invalid();
  const octets = match.slice(1, 5).map(Number);
  if (
    octets.some((v, i) => v > 255 || String(v) !== match[i + 1]) ||
    !(
      octets[0] === 10 ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168) ||
      (octets[0] === 169 && octets[1] === 254)
    )
  )
    throw invalid();
  return { expectedId: id, code, address: octets.join(".") + ":42673" };
}
