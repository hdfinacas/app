import { spawnSync } from "node:child_process";

const accountId = "a9c0b4b1e1b5bc1fd2ff2fce91bdcd07";
const projectName = "hdfinanceira-sbs";
const windows = process.platform === "win32";
const env = { ...process.env, CLOUDFLARE_ACCOUNT_ID: accountId };

function run(command, args) {
  const result = spawnSync(command, args, {
    env,
    shell: windows,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const npm = windows ? "npm.cmd" : "npm";
const npx = windows ? "npx.cmd" : "npx";

run(npx, ["wrangler", "whoami"]);
run(npm, ["run", "build"]);
run(npx, [
  "wrangler",
  "pages",
  "deploy",
  "dist",
  `--project-name=${projectName}`,
  "--branch=main",
]);
