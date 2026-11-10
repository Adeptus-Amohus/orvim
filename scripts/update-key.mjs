import fs from "node:fs";
import path from "node:path";
import { generateKeyPairSync } from "node:crypto";
const [destination] = process.argv.slice(2);
if (!destination) throw Error("Specify a new key file outside the project.");
const file = path.resolve(destination),
  project = fs.realpathSync(".");
if (
  file.toLowerCase().startsWith(project.toLowerCase() + path.sep) ||
  fs.existsSync(file)
)
  throw Error(
    "Use a new path outside the repository; existing keys are never overwritten.",
  );
fs.mkdirSync(path.dirname(file), { recursive: true });
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
fs.writeFileSync(file, privateKey.export({ format: "pem", type: "pkcs8" }), {
  flag: "wx",
  mode: 0o600,
});
console.log(
  "Private key saved outside the repository. Keep it offline and restrict access in Windows.",
);
console.log(
  "ORVIM_UPDATE_PUBLIC_KEY=" +
    publicKey
      .export({ format: "der", type: "spki" })
      .subarray(-32)
      .toString("base64"),
);
