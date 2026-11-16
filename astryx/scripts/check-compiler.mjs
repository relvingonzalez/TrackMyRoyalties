/**
 * Fails if React Compiler skips any function in src/. The compiler silently leaves a
 * component un-optimized when it hits code it can't handle (e.g. try/finally) or can't
 * prove follows the Rules of React; the lint rules catch most rule breaks, this catches
 * the rest.  Usage: npm run check:compiler
 */
import {globSync} from 'node:fs';
import {transformFileAsync} from '@babel/core';

const problems = [];
let compiled = 0;
const logger = {
  logEvent(fileName, event) {
    if (event.kind === 'CompileSuccess') compiled++;
    else if (['CompileError', 'CompileSkip', 'CompileDiagnostic', 'PipelineError'].includes(event.kind)) {
      problems.push(`${fileName}: ${event.kind}: ${event.detail?.reason ?? JSON.stringify(event.detail)}`);
    }
  },
};

// src/themes/ is generated theme code (Astryx theme editor), not React components.
for (const file of globSync('src/**/*.{js,jsx}', {exclude: path => path.startsWith('src/themes')})) {
  await transformFileAsync(file, {
    babelrc: false,
    configFile: false,
    parserOpts: {plugins: ['jsx']},
    plugins: [['babel-plugin-react-compiler', {logger, panicThreshold: 'none'}]],
  });
}

console.log(`React Compiler: ${compiled} functions compiled, ${problems.length} skipped.`);
if (problems.length) {
  console.log(problems.join('\n'));
  process.exit(1);
}
