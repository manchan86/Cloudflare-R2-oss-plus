import { run as runApiKeyTests } from "./apikey.test.mjs";
import { run as runAuthTests } from "./auth.test.mjs";
import { run as runFileOpsTests } from "./file-ops.test.mjs";

const suites = [
  ["auth", runAuthTests],
  ["apikey", runApiKeyTests],
  ["file-ops", runFileOpsTests],
];

let failed = false;

for (const [name, runner] of suites) {
  try {
    await runner();
    console.log(`PASS ${name}`);
  } catch (error) {
    failed = true;
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}

if (failed) {
  process.exit(1);
}
