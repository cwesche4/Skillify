import { execSync } from "node:child_process";

console.log("🔍 Running TypeScript type check (tsc --build)…");
execSync("tsc --build --pretty", { stdio: "inherit" });