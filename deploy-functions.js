import { readdirSync, statSync } from "fs";
import { execSync } from "child_process";
import path from "path";

const functionsDir = "./supabase/functions";

// Only allow valid Supabase function names
const isValidFunctionName = (name) => {
  return /^[A-Za-z][A-Za-z0-9_-]*$/.test(name);
};

const functions = readdirSync(functionsDir).filter((fn) => {
  const fullPath = path.join(functionsDir, fn);

  return (
    statSync(fullPath).isDirectory() && // must be a folder
    isValidFunctionName(fn) &&          // must match naming rules
    fn !== "node_modules"               // ignore junk
  );
});

functions.forEach((fn) => {
  console.log(`Deploying ${fn}...`);
  execSync(`npx supabase functions deploy ${fn}`, {
    stdio: "inherit",
  });
});