/* ============================================================
   همگام‌سازی امن Source → pp/www  (فقط فایل‌های اجرایی اپ)
   ------------------------------------------------------------
   اجرا:  node tools/sync-www.js            → اعمال (کپی)
          node tools/sync-www.js --check    → فقط گزارش، بدون تغییر
   نکته: این اسکریپت هیچ‌وقت ابزارهای توسعه (assets/render-3d,
   assets/fetch-3d.js, tools/) را به خروجی اپ منتقل نمی‌کند.
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const WWW = path.join(ROOT, 'pp', 'www');
const CHECK = process.argv.includes('--check');

/* فایل‌ها/پوشه‌هایی که جزء خروجی اپ هستند */
const INCLUDE = [
  'index.html', 'manifest.json', 'sw.js',
  'css', 'js', 'data', 'fonts', 'icons', 'assets/3d'
];
/* چیزهایی که هرگز نباید وارد خروجی شوند */
const EXCLUDE = ['node_modules', '.git', '.agents', '.cache', 'render-3d', 'tools', 'tests'];

function walk(dir, rel = '', out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE.includes(e.name) || e.name.startsWith('.')) continue;
    if (e.name.endsWith('.json') && rel.startsWith('assets')) continue;   /* فراداده، نه فایل اجرایی */
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) walk(path.join(dir, e.name), r, out);
    else out.push(r);
  }
  return out;
}

const srcFiles = [];
for (const item of INCLUDE) {
  const p = path.join(ROOT, item);
  if (!fs.existsSync(p)) { console.log('  ! نبود:', item); continue; }
  if (fs.statSync(p).isDirectory()) srcFiles.push(...walk(p, item));
  else srcFiles.push(item);
}

const dstFiles = fs.existsSync(WWW) ? walk(WWW) : [];
const sha = f => crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex').slice(0, 12);

let copied = 0, same = 0;
const removed = [], added = [];
for (const f of srcFiles) {
  const s = path.join(ROOT, f), d = path.join(WWW, f);
  if (!fs.existsSync(d)) { added.push(f); if (!CHECK) { fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(s, d); } copied++; continue; }
  if (sha(s) !== sha(d)) { added.push(f); if (!CHECK) { fs.copyFileSync(s, d); } copied++; }
  else same++;
}
const srcSet = new Set(srcFiles);
for (const f of dstFiles) if (!srcSet.has(f)) { removed.push(f); if (!CHECK) { try { fs.unlinkSync(path.join(WWW, f)); } catch (e) { } } }

console.log(CHECK ? '🔍 بررسی همگام‌سازی (بدون تغییر):' : '✅ همگام‌سازی انجام شد:');
console.log(`   فایل‌های اجرایی: ${srcFiles.length} · یکسان: ${same} · نیازمند کپی: ${copied}`);
added.forEach(f => console.log('   + ' + f));
removed.forEach(f => console.log('   - ' + f));
if (removed.length) console.log('   ⚠ فایل‌های اضافی در مقصد حذف شدند (خارج از لیست اجرایی)');
console.log(`   حجم خروجی: ${(srcFiles.reduce((a, f) => a + fs.statSync(path.join(ROOT, f)).size, 0) / 1024 / 1024).toFixed(2)} MB`);
