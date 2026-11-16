import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';
import react, {reactCompilerPreset} from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';

const srcDir = fileURLToPath(new URL('./src/', import.meta.url));

// React Compiler (babel-plugin-react-compiler 1.0) auto-memoizes components and hooks.
// It relies on the Rules of React — never mutate state/props, see useLedger's update() —
// which eslint-plugin-react-hooks checks (`npm run lint`). Only this app's src/ is
// compiled: the classic app's js/*.js it imports are plain scripts with no React in them.
const compiler = reactCompilerPreset();
compiler.rolldown.filter.id = {include: new RegExp(`^${srcDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*\\.jsx?$`)};

export default defineConfig({
  // Relative asset paths so the build works from any sub-path, in particular
  // /astryx/dist/ served from the repo root, which shares an origin (and so the IndexedDB
  // data) with the classic app.
  base: './',
  plugins: [react(), babel({presets: [compiler]})],
  server: {
    // The app imports the classic app's js/ and assets/ from one level up.
    fs: {allow: ['..']},
  },
});
