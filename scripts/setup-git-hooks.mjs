import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { workspaceRoot } from "./version-utils.mjs";

if (!existsSync(path.join(workspaceRoot, ".git"))) {
  process.exit(0);
}

const result = spawnSync("git", ["config", "core.hooksPath", ".githooks"], {
  cwd: workspaceRoot,
  stdio: "inherit",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}