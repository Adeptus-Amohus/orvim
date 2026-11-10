import fs from "node:fs";
import { createPrivateKey, createPublicKey, sign } from "node:crypto";
const [source, destination] = process.argv.slice(2);
if (!source || !destination)
  throw Error(
    "Usage: node scripts/sign-update-manifest.mjs unsigned.json orvim-updates.json",
  );
const pem =
  process.env.ORVIM_UPDATE_PRIVATE_KEY_PEM ||
  process.env.LIFE_OS_UPDATE_PRIVATE_KEY_PEM ||
  (process.env.ORVIM_UPDATE_PRIVATE_KEY_FILE ||
  process.env.LIFE_OS_UPDATE_PRIVATE_KEY_FILE
    ? fs.readFileSync(
        process.env.ORVIM_UPDATE_PRIVATE_KEY_FILE ||
          process.env.LIFE_OS_UPDATE_PRIVATE_KEY_FILE,
        "utf8",
      )
    : null);
if (!pem)
  throw Error(
    "Set ORVIM_UPDATE_PRIVATE_KEY_FILE to a private key kept outside the repository.",
  );
const key = createPrivateKey(pem),
  payload = fs.readFileSync(source);
const manifest = JSON.parse(payload);
if (manifest.manifest_version !== 1 || !Array.isArray(manifest.releases))
  throw Error("Unsupported manifest.");
const signature = sign(null, payload, key);
fs.writeFileSync(
  destination,
  JSON.stringify(
    {
      payload: payload.toString("base64"),
      signature: signature.toString("base64"),
    },
    null,
    2,
  ) + "\n",
);
const publicKey = createPublicKey(key)
  .export({ format: "der", type: "spki" })
  .subarray(-32)
  .toString("base64");
console.log(
  "Manifest signed. Build trust key ORVIM_UPDATE_PUBLIC_KEY=" + publicKey,
);
