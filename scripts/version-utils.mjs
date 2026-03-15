import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const VERSION_SUFFIX = "-hotfix";

const VERSION_PATTERN =
  /^(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)-hotfix$/;

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);

export const workspaceRoot = path.resolve(currentDir, "..");

export function normalizeVersionInput(version) {
  return version.trim().replace(/^v/, "");
}

export function parseVersion(version) {
  const normalizedVersion = normalizeVersionInput(version);
  const match = VERSION_PATTERN.exec(normalizedVersion);

  if (!match?.groups) {
    throw new Error(
      `Invalid version \"${version}\". Expected format ${formatVersionExample()}.`,
    );
  }

  return {
    version: normalizedVersion,
    major: Number(match.groups.major),
    minor: Number(match.groups.minor),
    patch: Number(match.groups.patch),
  };
}

export function formatTag(version) {
  return `v${parseVersion(version).version}`;
}

export function formatVersionExample() {
  return "v<major>.<minor>.<patch>-hotfix";
}

export function getNextVersion(currentVersion, releaseType) {
  const { major, minor, patch } = parseVersion(currentVersion);

  switch (releaseType) {
    case "major":
      return `${major + 1}.0.0${VERSION_SUFFIX}`;
    case "minor":
      return `${major}.${minor + 1}.0${VERSION_SUFFIX}`;
    case "patch":
    case "hotfix":
      return `${major}.${minor}.${patch + 1}${VERSION_SUFFIX}`;
    default:
      throw new Error(
        `Unknown release type \"${releaseType}\". Use major, minor, patch, hotfix, or set.`,
      );
  }
}

export function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

export function writeJson(filePath, value) {
  const nextContent = `${JSON.stringify(value, null, 2)}\n`;
  return writeText(filePath, nextContent);
}

export function writeText(filePath, nextContent) {
  let currentContent = "";

  try {
    currentContent = readFileSync(filePath, "utf8");
  } catch {
    currentContent = "";
  }

  if (currentContent === nextContent) {
    return false;
  }

  writeFileSync(filePath, nextContent, "utf8");
  return true;
}

export function syncLockfileVersion(lockfilePath, version) {
  const lockfile = readJson(lockfilePath);
  let changed = false;

  if (lockfile.version !== version) {
    lockfile.version = version;
    changed = true;
  }

  if (lockfile.packages?.[""]?.version !== version) {
    lockfile.packages[""] = {
      ...lockfile.packages[""],
      version,
    };
    changed = true;
  }

  if (changed) {
    writeJson(lockfilePath, lockfile);
  }

  return changed;
}