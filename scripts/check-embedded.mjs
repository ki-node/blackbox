import { lstat, readFile, readdir } from "node:fs/promises";
import { dirname, join, normalize, relative, resolve } from "node:path";

const outputRoot = resolve("dist-embedded");
const files = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    const stats = await lstat(path);
    if (stats.isSymbolicLink()) throw new Error(`Symlink found: ${path}`);
    if (stats.isDirectory()) await walk(path);
    else files.push(path);
  }
}

function assertLocalReference(reference, sourceFile) {
  if (
    reference.startsWith("#") ||
    reference.startsWith("data:") ||
    reference.startsWith("mailto:")
  ) {
    return;
  }
  if (/^(?:https?:)?\/\//i.test(reference)) {
    throw new Error(
      `External runtime reference in ${sourceFile}: ${reference}`,
    );
  }

  const clean = reference.split(/[?#]/, 1)[0];
  if (!clean) return;
  if (clean.startsWith("/") || clean.includes("..")) {
    throw new Error(`Non-relocatable reference in ${sourceFile}: ${reference}`);
  }

  let target = resolve(dirname(sourceFile), normalize(clean));
  if (clean.endsWith("/")) target = join(target, "index.html");
  const relativeTarget = relative(outputRoot, target);
  if (relativeTarget.startsWith("..") || relativeTarget === "") {
    if (relativeTarget !== "") {
      throw new Error(`Reference escapes the build: ${reference}`);
    }
  }
  if (!files.includes(target)) {
    throw new Error(`Missing local asset in ${sourceFile}: ${reference}`);
  }
}

await walk(outputRoot);
if (!files.length) throw new Error("dist-embedded is empty");

for (const file of files.filter((path) => /\.(?:html|css|js)$/.test(path))) {
  const content = await readFile(file, "utf8");
  const references = [
    ...content.matchAll(/(?:src|href)=["']([^"']+)["']/gi),
    ...content.matchAll(/url\(["']?([^"')]+)["']?\)/gi),
  ];
  references.forEach((match) => assertLocalReference(match[1], file));
  if (/serviceWorker\s*\.\s*register/.test(content)) {
    throw new Error(`Service worker registration found in ${file}`);
  }
  if (
    /\b(?:https?:)?\/\/[^/]/i.test(
      content.replaceAll("http://www.w3.org/2000/svg", ""),
    )
  ) {
    throw new Error(`External URL found in ${file}`);
  }
}

const html = await readFile(join(outputRoot, "index.html"), "utf8");
if (!html.includes('data-runtime-context="embedded"')) {
  throw new Error("Embedded runtime marker is missing");
}
if (/data-install|rel="manifest"|beforeinstallprompt/.test(html)) {
  throw new Error("PWA installation UI found in embedded HTML");
}

const provenancePath = join(outputRoot, "ki-node-project.json");
const provenanceText = await readFile(provenancePath, "utf8");
const provenance = JSON.parse(provenanceText);
const expected = {
  project: "blackbox",
  repository: "ki-node/blackbox",
  buildCommand: "npm run build:embedded",
  context: "embedded",
  formatVersion: 1,
};
for (const [key, value] of Object.entries(expected)) {
  if (provenance[key] !== value) {
    throw new Error(`Invalid provenance field ${key}`);
  }
}
if (!/^[a-f0-9]{40}$/.test(provenance.commit)) {
  throw new Error("Provenance commit is not a full SHA");
}
if (/timestamp|created|date|\/workspace\/|\\\\|file:/i.test(provenanceText)) {
  throw new Error("Provenance contains nondeterministic or local data");
}

console.log(`Validated ${files.length} embedded build files`);
