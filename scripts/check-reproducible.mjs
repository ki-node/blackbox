import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

const root = resolve(".");
const output = join(root, "dist-embedded");

async function digest(directory) {
  const entries = [];
  async function walk(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) await walk(path);
      else entries.push(path);
    }
  }
  await walk(directory);
  entries.sort();
  const hash = createHash("sha256");
  for (const path of entries) {
    hash.update(relative(directory, path));
    hash.update("\0");
    hash.update(await readFile(path));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function build() {
  const result = spawnSync("npm", ["run", "build:embedded"], {
    cwd: root,
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

build();
const first = await digest(output);
build();
const second = await digest(output);

if (first !== second) {
  throw new Error(`Embedded builds differ: ${first} != ${second}`);
}
console.log(`Reproducible embedded build: ${second}`);
