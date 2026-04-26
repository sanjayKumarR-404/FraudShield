const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const configPath = ts.findConfigFile(__dirname, ts.sys.fileExists, 'tsconfig.json');
if (!configPath) {
    console.error("Could not find a valid 'tsconfig.json'.");
    process.exit(1);
}

const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, __dirname);

const program = ts.createProgram(parsedConfig.fileNames, parsedConfig.options);
const emitResult = program.emit();

let allDiagnostics = ts
    .getPreEmitDiagnostics(program)
    .concat(emitResult.diagnostics);

let errorText = '';
allDiagnostics.forEach(diagnostic => {
    if (diagnostic.file) {
        const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
        const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
        errorText += `${diagnostic.file.fileName} (${line + 1},${character + 1}): error TS${diagnostic.code}: ${message}\n`;
    } else {
        errorText += ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n') + '\n';
    }
});

fs.writeFileSync(path.join(__dirname, 'ts_errors.log'), errorText, 'utf8');
console.log('Errors written to ts_errors.log. Total errors:', allDiagnostics.length);
