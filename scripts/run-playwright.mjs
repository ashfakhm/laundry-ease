import { spawn } from "node:child_process";

const env = { ...process.env };
delete env.NO_COLOR;

const args = ["playwright", "test", ...process.argv.slice(2)];
const command = process.platform === "win32" ? "npx.cmd" : "npx";

const child = spawn(command, args, {
  stdio: "inherit",
  env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
