import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";

const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_PATH || "sharp");
const artwork = "src/assets/branding/ceramic-native.png";
const { data, info } = await sharp(artwork)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
let left = info.width,
  top = info.height,
  right = -1,
  bottom = -1;
for (let y = 0; y < info.height; y++)
  for (let x = 0; x < info.width; x++)
    // Ignore almost-transparent pixels left at the edges of the source canvas.
    if (data[(y * info.width + x) * 4 + 3] >= 16) {
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
if (right < left) throw new Error("The tray artwork is empty.");
// Windows owns the tray slot size. Remove launcher padding so the artwork fills
// nearly all 16 logical pixels, with a small transparent edge for antialiasing.
const cropped = await sharp(artwork)
  .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
  .png()
  .toBuffer();
const icon = await sharp(cropped)
  .resize(62, 62, { fit: "contain", background: "#00000000" })
  .extend({ top: 1, right: 1, bottom: 1, left: 1, background: "#00000000" })
  .png()
  .toBuffer();
await writeFile("src-tauri/icons/tray.png", icon);

// Preview at actual slot sizes, enlarged with nearest-neighbour for inspection.
const sizes = [16, 20, 24, 32];
const layers = [];
for (const [column, size] of sizes.entries()) {
  for (const [row, source] of ["src-tauri/icons/128x128.png", icon].entries()) {
    layers.push({
      input: await sharp(source).resize(size, size).png().toBuffer(),
      left: column * 48 + Math.floor((48 - size) / 2),
      top: row * 48 + Math.floor((48 - size) / 2),
    });
  }
}
await mkdir(".artifacts/tray", { recursive: true });
const preview = await sharp({
  create: { width: 192, height: 96, channels: 4, background: "#303030" },
})
  .composite(layers)
  .png()
  .toBuffer();
await sharp(preview)
  .resize(768, 384, { kernel: "nearest" })
  .toFile(".artifacts/tray/size-comparison.png");
console.log(
  "Exported 64px tray icon; preview rows: previous / new; columns: 16, 20, 24, 32px.",
);
