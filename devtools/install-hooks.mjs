import { existsSync } from "node:fs";

if (existsSync(".git") && existsSync("node_modules/husky")) {
  const { default: husky } = await import("husky");
  const message = husky();
  if (message) console.log(message);
}
