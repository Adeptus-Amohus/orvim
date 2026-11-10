import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ceramicSvg } from "../src/features/workspace/ceramic-brand.js";

const assets = resolve("src/assets/branding");
for (const palette of ["sun", "pine", "scarlet", "winter"]) {
  for (const appearance of ["light", "dark"]) {
    await writeFile(
      resolve(assets, `ceramic-${palette}-${appearance}.svg`),
      ceramicSvg(palette, appearance) + "\n",
    );
  }
}
await writeFile(
  resolve(assets, "ceramic-emblem.svg"),
  ceramicSvg("sun", "light") + "\n",
);
await writeFile(
  resolve("public/favicon.svg"),
  ceramicSvg("sun", "light") + "\n",
);
