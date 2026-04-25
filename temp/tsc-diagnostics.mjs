import ts from "typescript";
import path from "node:path";

const configPath = path.resolve("tsconfig.json");
const configFile = ts.readConfigFile(configPath, ts.sys.readFile);

if (configFile.error) {
  const message = ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n");
  console.error(message);
  process.exit(1);
}

const configDir = path.dirname(configPath);
const parsed = ts.parseJsonConfigFileContent(
  configFile.config,
  ts.sys,
  configDir,
  undefined,
  configPath,
);

const program = ts.createProgram({
  rootNames: parsed.fileNames,
  options: parsed.options,
});

const diagnostics = ts.getPreEmitDiagnostics(program);

if (diagnostics.length === 0) {
  console.log("No TypeScript diagnostics found.");
  process.exit(0);
}

for (const diagnostic of diagnostics) {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
  if (diagnostic.file && typeof diagnostic.start === "number") {
    const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    const fileName = path.relative(process.cwd(), diagnostic.file.fileName);
    console.log(`${fileName}:${line + 1}:${character + 1} - ${message}`);
  } else {
    console.log(message);
  }
}

process.exit(1);
