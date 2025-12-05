import { execSync } from "child_process";

console.log("🏗️ Building Skillify...");
execSync("next build", { stdio: "inherit" });