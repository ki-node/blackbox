import { execFileSync, spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";

const repositoryRoot = new URL("../", import.meta.url);
const sourceStatus = execFileSync(
  "git",
  [
    "status",
    "--porcelain",
    "--untracked-files=all",
    "--",
    ".",
    ":(exclude)dist",
    ":(exclude)dist-embedded",
  ],
  { cwd: repositoryRoot, encoding: "utf8" },
).trim();

if (sourceStatus) {
  throw new Error(
    "Embedded provenance requires a clean committed source tree. Commit the source changes before building.",
  );
}

const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: repositoryRoot,
  encoding: "utf8",
}).trim();

if (!/^[a-f0-9]{40}$/.test(commit)) {
  throw new Error(`Invalid source commit: ${commit}`);
}

const vite = spawnSync(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "build", "--mode", "embedded"],
  { cwd: repositoryRoot, stdio: "inherit" },
);
if (vite.status !== 0) process.exit(vite.status ?? 1);

const provenance = {
  project: "blackbox",
  repository: "ki-node/blackbox",
  commit,
  buildCommand: "npm run build:embedded",
  context: "embedded",
  formatVersion: 1,
};

await writeFile(
  new URL("../dist-embedded/ki-node-project.json", import.meta.url),
  `${JSON.stringify(provenance, null, "\t")}\n`,
  "utf8",
);
