import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_PATH || "sharp");
// Use the same ceramic artwork as Android, including the brass vertex details.
// App chrome keeps its separate, simplified vector emblem.
const nativeArtwork = resolve("src/assets/branding/ceramic-native.png");
const artwork = await sharp(nativeArtwork)
  .resize(512, 512, { fit: "contain" })
  .ensureAlpha()
  .png()
  .toBuffer();
await writeFile("src/assets/branding/ceramic-windows.png", artwork);
const sizes = [16, 24, 32, 48, 64, 128, 256],
  images = [];
for (const size of sizes)
  images.push(
    await sharp(artwork).resize(size, size).ensureAlpha().png().toBuffer(),
  );
const directory = Buffer.alloc(6 + sizes.length * 16);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(sizes.length, 4);
let offset = directory.length;
for (const [index, size] of sizes.entries()) {
  const entry = 6 + index * 16;
  directory[entry] = directory[entry + 1] = size === 256 ? 0 : size;
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(images[index].length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += images[index].length;
}
const ico = Buffer.concat([directory, ...images]);
await writeFile("src-tauri/icons/icon.ico", ico);
await writeFile("src-tauri/icons/windows-shortcut.ico", ico);
for (const [file, size] of [
  ["32x32.png", 32],
  ["64x64.png", 64],
  ["128x128.png", 128],
  ["128x128@2x.png", 256],
  ["icon.png", 512],
  ["Square30x30Logo.png", 30],
  ["Square44x44Logo.png", 44],
  ["Square71x71Logo.png", 71],
  ["Square89x89Logo.png", 89],
  ["Square107x107Logo.png", 107],
  ["Square142x142Logo.png", 142],
  ["Square150x150Logo.png", 150],
  ["Square284x284Logo.png", 284],
  ["Square310x310Logo.png", 310],
  ["StoreLogo.png", 50],
])
  await sharp(artwork)
    .resize(size, size)
    .ensureAlpha()
    .png()
    .toFile("src-tauri/icons/" + file);
console.log(
  "Exported ceramic Windows icon and shortcut resources from the Android artwork.",
);
