import { spawnSync } from "node:child_process";
import path from "node:path";

import {
  formatTag,
  getNextVersion,
  parseVersion,
  readJson,
  workspaceRoot,
} from "./version-utils.mjs";

const [releaseType, rawVersion] = process.argv.slice(2);

if (!releaseType) {
  console.error("Usage: node scripts/version-bump.mjs <major|minor|patch|hotfix|set> [vX.Y.Z-hotfix]");
  process.exit(1);
}

const rootPackageJson = readJson(path.join(workspaceRoot, "package.json"));
const currentVersion = parseVersion(rootPackageJson.version).version;

const nextVersion =
  releaseType === "set"
    ? parseVersion(rawVersion ?? "").version
    : getNextVersion(currentVersion, releaseType);

console.log(`Releasing ${formatTag(nextVersion)}`);

const result = spawnSync("npm", ["version", nextVersion], {
  cwd: workspaceRoot,
  stdio: "inherit",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}