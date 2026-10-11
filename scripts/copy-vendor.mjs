// index.html が読み込むライブラリを、node_modules から js/vendor/ へコピーする。
// js/vendor/ はコミットしない。手元では npm install のあとに、公開時は Cloudflare Pages のビルドで実行される。
import { cpSync, rmSync } from 'node:fs';

// [コピー元（node_modules からの相対パス）, コピー先（js/vendor からの相対パス）]
const TARGETS = [
  ['jquery/dist/jquery.min.js', 'jquery.min.js'],
  ['interactjs/dist/interact.min.js', 'interact.min.js'],
  ['@mogamoga1024/vertical-text-canvas/vertical_text_canvas.js', 'vertical_text_canvas.js'],
];

const root = new URL('../', import.meta.url);

rmSync(new URL('js/vendor/', root), { recursive: true, force: true });
for (const [from, to] of TARGETS) {
  cpSync(new URL(`node_modules/${from}`, root), new URL(`js/vendor/${to}`, root), { recursive: true });
}
console.log(`js/vendor/ に ${TARGETS.length} 件をコピーしました。`);
