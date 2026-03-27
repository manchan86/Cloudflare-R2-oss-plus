import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tscEntrypoint = resolve(rootDir, "node_modules/typescript/bin/tsc");
const compiledDir = resolve(rootDir, ".tmp-test");

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

rmSync(compiledDir, { recursive: true, force: true });
try {
  run(process.execPath, [tscEntrypoint, "-p", "tsconfig.test.json"]);
  run(process.execPath, ["tests/run-all.mjs"]);
} finally {
  rmSync(compiledDir, { recursive: true, force: true });
}
