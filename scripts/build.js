#!/usr/bin/env node
/*
 * Bouwt dist/MeMeet.html (altijd de laatste versie; de vorige versie wordt bewaard als dist/archive/MeMeet-v<versie>.html): één zelfstandig HTML-bestand met alle code en bibliotheken erin.
 * Gebruik:  npm install   en daarna   npm run build
 */
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const root = path.join(__dirname, '..');
const src = (f) => fs.readFileSync(path.join(root, 'src', f), 'utf8');
const mod = (p) => require.resolve(p, { paths: [root] });
const noScriptClose = (s) => s.replace(/<\/script/gi, '<\\/script');

// pdf.js wordt als ES-module geleverd; omzetten naar een klassiek script (werkt ook vanaf file://)
function bundleIife(entry, globalName) {
  const r = esbuild.buildSync({ entryPoints: [entry], bundle: true, format: 'iife', globalName, minify: true, target: 'es2020', write: false, logLevel: 'error' });
  return r.outputFiles[0].text;
}

const app = "(function(){'use strict';var W=window,D=document;\n" +
  ['mail-parser.js', 'convert.js', 'pptx-render.js', 'editor.js', 'notes.js', 'reports.js', 'annotations.js', 'files.js', 'help.js', 'app-ui.js'].map(src).join('\n') + '\n})();'
// De Outlook-macro voor de weekagenda staat in outlook/; die wordt in de app gezet zodat gebruikers hem kunnen kopiëren.
const macro = fs.readFileSync(path.join(root, 'outlook', 'MeMeet-weekagenda.bas'), 'utf8').replace(/\r?\n/g, '\r\n');
const appWithMacro = app.replace('__OUTLOOK_MACRO__', () => JSON.stringify(macro))
  // het icoon (.ico) voor de snelkoppeling op het bureaublad
  .replace('__MEMEET_ICO__', () => JSON.stringify(fs.readFileSync(path.join(root, 'icons', '2-tafel.ico')).toString('base64')))
  // WebAssembly van pdf.js voor ingescande PDF's (CCITT-fax en JBIG2, JPEG 2000)
  .replace('__PDFJS_WASM__', () => { const dir = path.join(path.dirname(mod('pdfjs-dist/build/pdf.min.mjs')), '..', 'wasm'), o = {}; ['jbig2.wasm', 'openjpeg.wasm'].forEach((f) => { o[f] = fs.readFileSync(path.join(dir, f)).toString('base64'); }); return JSON.stringify(o); });

const libs = [mod('pdf-lib/dist/pdf-lib.min.js'), mod('jszip/dist/jszip.min.js')].map((f) => fs.readFileSync(f, 'utf8')).join('\n;\n');
const pdfjs = bundleIife(mod('pdfjs-dist/build/pdf.worker.min.mjs'), 'pdfjsWorker') + '\n;\n' + bundleIife(mod('pdfjs-dist/build/pdf.min.mjs'), 'pdfjsLib');
const icon = 'data:image/svg+xml;base64,' + Buffer.from(src('icon.svg').replace(/\s*\n\s*/g, ' ')).toString('base64');

const html = src('app.html')
  .replace(/__ICON_URI__/g, () => icon)
  .replace('__LIBS__', () => noScriptClose(libs))
  .replace('__PDFJS__', () => noScriptClose(pdfjs))
  .replace('__SCRIPT__', () => noScriptClose(appWithMacro));

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const version = require(path.join(root, 'package.json')).version;
const marker = '<!-- MeMeet-versie: ' + version + ' -->';
// licentie en meegeleverde onderdelen, zodat dat ook in het losse bestand te lezen is
const notice = '<!--\n  MeMeet ' + version + ' © oss-aigp en bijdragers, https://github.com/oss-aigp/memeet\n  Licentie: European Union Public Licence v. 1.2 (EUPL-1.2), zie LICENSE.\n  Bevat pdf.js (Apache-2.0, Mozilla Foundation) met de JBIG2-decoder (PDFium, BSD-3-Clause) en de JPEG 2000-decoder (OpenJPEG, BSD-2-Clause), pdf-lib met standard-fonts, upng, pako en tslib (MIT, MIT AND Zlib, 0BSD)\n  en JSZip (MIT of GPL-3.0); volledige teksten in THIRD-PARTY-NOTICES.md.\n-->';
const out = html.replace(/^(<!doctype[^>]*>)/i, (m) => m + '\n' + marker + '\n' + notice);
// De laatste versie heet altijd MeMeet.html. Een eerdere versie gaat naar dist/archive, met zijn versienummer in de naam.
const latest = path.join(root, 'dist', 'MeMeet.html'), archive = path.join(root, 'dist', 'archive');
fs.mkdirSync(archive, { recursive: true });
if (fs.existsSync(latest)) {
  const prev = (/<!-- MeMeet-versie: ([^ ]+) -->/.exec(fs.readFileSync(latest, 'utf8').slice(0, 300)) || [])[1];
  if (prev && prev !== version) fs.copyFileSync(latest, path.join(archive, 'MeMeet-v' + prev + '.html'));
}
// oude versies die nog los in dist staan, ook naar het archief
fs.readdirSync(path.join(root, 'dist')).filter((f) => /^MeMeet-v.+\.html$/.test(f)).forEach((f) => fs.renameSync(path.join(root, 'dist', f), path.join(archive, f)));
fs.writeFileSync(latest, out);
console.log('dist/MeMeet.html (v' + version + ') gemaakt (' + Math.round(out.length / 1024) + ' kB)');
