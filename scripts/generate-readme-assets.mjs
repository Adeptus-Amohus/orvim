import fs from "node:fs/promises";

// Self-contained SVG layouts: GitHub does not need external image hosts or fonts.
// Source images are embedded unchanged. No application state is read.
const root = new URL("../", import.meta.url);
const output = new URL("docs/assets/readme/", root);
const embed = async (file, mime) =>
  `data:${mime};base64,${(await fs.readFile(new URL(file, root))).toString("base64")}`;
const [emblem, desktop, mobile] = await Promise.all([
  embed("src/assets/branding/ceramic-windows.png", "image/png"),
  embed("docs/assets/readme/home-desktop.jpg", "image/jpeg"),
  embed("docs/assets/readme/home-mobile.jpg", "image/jpeg"),
]);

await fs.writeFile(
  new URL("hero.svg", output),
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="250" viewBox="0 0 1200 250" role="img" aria-labelledby="title desc">
  <title id="title">Orvim — A foundation for your success.</title>
  <desc id="desc">The Orvim wordmark and original ivory ceramic app icon on a soft sage background.</desc>
  <defs>
    <linearGradient id="paper" x1="0" y1="0" x2="1200" y2="250" gradientUnits="userSpaceOnUse"><stop stop-color="#f8f6ef"/><stop offset="1" stop-color="#e9efe9"/></linearGradient>
    <radialGradient id="light"><stop stop-color="#fffdf7"/><stop offset="1" stop-color="#fffdf7" stop-opacity="0"/></radialGradient>
    <clipPath id="bounds"><rect width="1200" height="250" rx="24"/></clipPath>
  </defs>
  <g clip-path="url(#bounds)">
    <rect width="1200" height="250" fill="url(#paper)"/>
    <circle cx="1020" cy="110" r="250" fill="url(#light)"/>
    <circle cx="1010" cy="125" r="142" fill="none" stroke="#d4dfd3"/>
    <circle cx="1010" cy="125" r="184" fill="none" stroke="#dce5d9"/>
    <rect x="58" y="43" width="34" height="4" rx="2" fill="#54785d"/>
    <text x="52" y="144" font-family="'Segoe UI',Arial,sans-serif" font-size="112" font-weight="650" letter-spacing="-5" fill="#263d32">Orvim</text>
    <text x="59" y="194" font-family="'Segoe UI',Arial,sans-serif" font-size="28" fill="#536859">A foundation for your success.</text>
    <image x="860" y="-25" width="300" height="300" href="${emblem}"/>
  </g>
</svg>
`,
);

await fs.writeFile(
  new URL("interface.svg", output),
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="650" viewBox="0 0 1200 650" role="img" aria-labelledby="title desc">
  <title id="title">Orvim: desktop and mobile layouts</title>
  <desc id="desc">Real browser screenshots with fictional records. Desktop schedule and tasks beside the same interface at 390 pixels. This is not an installed Android APK.</desc>
  <defs>
    <linearGradient id="surface" x1="0" y1="0" x2="1200" y2="650" gradientUnits="userSpaceOnUse"><stop stop-color="#f5f6f2"/><stop offset="1" stop-color="#e8eee8"/></linearGradient>
    <clipPath id="desktop"><rect x="30" y="90" width="900" height="506.56" rx="12"/></clipPath>
    <clipPath id="mobile"><rect x="961" y="137.77" width="211" height="456.62" rx="21"/></clipPath>
  </defs>
  <rect width="1200" height="650" rx="24" fill="url(#surface)"/>
  <g font-family="'Segoe UI',Arial,sans-serif" font-size="20" font-weight="600" fill="#435c4a">
    <text x="30" y="59">На компьютере</text>
    <text x="956" y="108">На телефоне</text>
  </g>
  <rect x="29" y="95" width="902" height="509" rx="13" fill="#c6d2c6" opacity=".4"/>
  <rect x="29" y="89" width="902" height="508.56" rx="13" fill="#cbd5cd"/>
  <image x="30" y="90" width="900" height="506.56" href="${desktop}" clip-path="url(#desktop)"/>
  <rect x="955" y="136" width="223" height="470" rx="27" fill="#c6d2c6" opacity=".5"/>
  <rect x="955" y="131.77" width="223" height="468.62" rx="27" fill="#344b3e"/>
  <image x="961" y="137.77" width="211" height="456.62" href="${mobile}" clip-path="url(#mobile)"/>
</svg>
`,
);

console.log("Generated docs/assets/readme/hero.svg and interface.svg");
