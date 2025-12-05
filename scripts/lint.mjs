import { execSync } from "child_process";

console.log("🔍 Running ESLint...");
execSync("eslint . --max-warnings=0", { stdio: "inherit" });