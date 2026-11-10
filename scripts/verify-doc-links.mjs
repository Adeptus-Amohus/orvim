import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const documents = ["README.md", "CONTRIBUTING.md", "SECURITY.md"];
async function collect(folder) {
  for (const entry of await fs.readdir(path.join(root, folder), {
    withFileTypes: true,
  })) {
    const name = path.posix.join(folder, entry.name);
    if (entry.isDirectory()) await collect(name);
    else if (entry.name.endsWith(".md")) documents.push(name);
  }
}
await collect("docs");
await collect("site/docs");
documents.push("site/README.md", "third-party/README.md");

function withoutCode(text) {
  return text.replace(/^\s*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\s*\1\s*$/gm, "");
}
function slug(text) {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/!?\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*~]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_\-\s]/gu, "")
    .replace(/\s/g, "-");
}
const cache = new Map();
async function anchors(filename) {
  if (cache.has(filename)) return cache.get(filename);
  const text = withoutCode(await fs.readFile(filename, "utf8"));
  const found = new Set();
  const duplicates = new Map();
  for (const match of text.matchAll(/^#{1,6}\s+(.+?)(?:\s+#+)?\s*$/gm)) {
    const base = slug(match[1]);
    const count = duplicates.get(base) || 0;
    found.add(count ? `${base}-${count}` : base);
    duplicates.set(base, count + 1);
  }
  for (const match of text.matchAll(/(?:id|name)=["']([^"']+)["']/g))
    found.add(match[1]);
  cache.set(filename, found);
  return found;
}
const errors = [];
let links = 0;
for (const document of documents) {
  const filename = path.join(root, document);
  const text = withoutCode(await fs.readFile(filename, "utf8"));
  const targets = [
    ...text.matchAll(/!?\[[^\]]*\]\(([^\s)]+)(?:\s+[^)]*)?\)/g),
  ].map((match) => match[1].replace(/^<|>$/g, ""));
  for (const match of text.matchAll(/(?:href|src)=["']([^"']+)["']/g))
    targets.push(match[1]);
  for (const match of text.matchAll(/srcset=["']([^"']+)["']/g))
    targets.push(
      ...match[1].split(",").map((part) => part.trim().split(/\s/)[0]),
    );
  for (const target of targets) {
    if (/^(?:[a-z]+:|\/\/)/i.test(target)) continue;
    links++;
    const [filePart, anchor] = target.split("#");
    const local = filePart
      ? path.resolve(
          path.dirname(filename),
          decodeURIComponent(filePart.split("?")[0]),
        )
      : filename;
    if (!local.startsWith(root)) {
      errors.push(`${document}: path escapes repository: ${target}`);
      continue;
    }
    try {
      await fs.access(local);
      if (anchor && /\.(?:md|html)$/.test(local)) {
        if (!(await anchors(local)).has(decodeURIComponent(anchor)))
          errors.push(`${document}: missing anchor: ${target}`);
      }
    } catch {
      errors.push(`${document}: missing file: ${target}`);
    }
  }
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Documentation verified: ${documents.length} documents, ${links} local links and anchors.`,
  );
}
