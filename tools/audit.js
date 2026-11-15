/* ============================================================
   ممیزی پیش از انتشار — بررسی مراجع، دارایی‌ها و اختلاف Source ↔ pp/www
   اجرا: node tools/audit.js
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const WWW = path.join(ROOT, 'pp', 'www');
const SKIP_DIRS = ['.git', 'node_modules', '.agents', '.cache', 'android', 'plugins', 'build'];

function walk(dir, rel = '', out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.includes(e.name) || e.name.startsWith('.')) continue;
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) walk(path.join(dir, e.name), r, out);
    else out.push(r);
  }
  return out;
}
const sha = f => crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex').slice(0, 12);
const size = f => fs.statSync(f).size;

console.log('='.repeat(64));
console.log('۱) موجودی پروژه‌ی اصلی');
const src = walk(ROOT).filter(f => !f.startsWith('pp/')).sort();
console.log('   فایل‌ها:', src.length);
const byExt = {};
src.forEach(f => { const e = path.extname(f) || '(none)'; byExt[e] = (byExt[e] || 0) + 1; });
console.log('   ', Object.entries(byExt).map(([k, v]) => `${k}:${v}`).join('  '));

console.log('\n۲) بررسی مراجع (Reference Integrity)');
const problems = [];
const refs = new Set();
// index.html
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
for (const m of html.matchAll(/(?:href|src)="([^"?]+)(?:\?[^"]*)?"/g)) {
  if (/^(https?:|data:|#|mailto:)/.test(m[1])) continue;
  refs.add(m[1]);
}
// js
for (const f of src.filter(f => f.startsWith('js/'))) {
  const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of s.matchAll(/['"](assets\/[^'"]+|css\/[^'"]+|js\/[^'"]+|icons\/[^'"]+|fonts\/[^'"]+|data\/[^'"]+)['"]/g)) refs.add(m[1]);
  for (const m of s.matchAll(/url\(['"]?([^'")]+)['"]?\)/g)) {
    if (!/^(https?:|data:|#)/.test(m[1])) refs.add(m[1]);
  }
}
// css — url() ها نسبت به پوشه‌ی خود فایل CSS حل می‌شوند
for (const f of src.filter(f => f.endsWith('.css'))) {
  const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const base = path.dirname(f);
  for (const m of s.matchAll(/url\(['"]?([^'")]+)['"]?\)/g)) {
    if (/^(https?:|data:|#)/.test(m[1])) continue;
    refs.add(path.join(base, m[1]).replace(/\\/g, '/'));
  }
}
// sw precache
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const swList = [];
for (const m of sw.matchAll(/^\s*'([^']+)',?\s*$/gm)) swList.push(m[1]);

let okRefs = 0;
for (const r of [...refs].sort()) {
  const p = path.join(ROOT, r);
  if (fs.existsSync(p)) { okRefs++; continue; }
  // ممکن است نام فایل محلی باشد (مثلاً fonts/...)
  const alt = path.join(ROOT, r.replace(/^\//, ''));
  if (fs.existsSync(alt)) { okRefs++; continue; }
  problems.push('مرجع گمشده: ' + r);
}
console.log(`   مراجع بررسی‌شده: ${refs.size} · معتبر: ${okRefs} · نامعتبر: ${problems.length}`);
problems.forEach(p => console.log('   ✗', p));

console.log('\n۳) Service Worker — فهرست کش');
const swMissing = swList.filter(p => p !== './' && !fs.existsSync(path.join(ROOT, p)));
console.log(`   ورودی‌های کش: ${swList.length} · موجود: ${swList.length - swMissing.length} · گمشده: ${swMissing.length}`);
swMissing.forEach(p => console.log('   ✗ در کش نیست:', p));
const threeD = src.filter(f => f.startsWith('assets/3d/') && f.endsWith('.webp'));
const threeDInSw = threeD.filter(f => swList.includes(f));
console.log(`   آیکن‌های ۳بعدی: ${threeD.length} فایل · در کش: ${threeDInSw.length}`);
threeD.filter(f => !threeDInSw.includes(f)).forEach(f => console.log('   ✗ خارج از کش:', f));
const fonts = src.filter(f => f.startsWith('fonts/') && f.endsWith('.woff2'));
const fontsInSw = fonts.filter(f => swList.includes(f));
console.log(`   فونت‌ها: ${fonts.length} · در کش: ${fontsInSw.length}`);
fonts.filter(f => !fontsInSw.includes(f)).forEach(f => console.log('   ✗ خارج از کش:', f));

console.log('\n۴) مقایسه Source ↔ pp/www');
if (!fs.existsSync(WWW)) { console.log('   ✗ پوشه‌ی pp/www وجود ندارد'); }
else {
  const www = walk(WWW).sort();
  const wwwSet = new Set(www);
  const srcSet = new Set(src);
  const newer = [], missing = [], older = [], extra = [];
  for (const f of src) {
    if (!wwwSet.has(f)) { missing.push(f); continue; }
    const a = sha(path.join(ROOT, f)), b = sha(path.join(WWW, f));
    if (a !== b) newer.push(f);
  }
  for (const f of www) if (!srcSet.has(f)) extra.push(f);
  console.log(`   فایل‌های Source: ${src.length} · فایل‌های مقصد: ${www.length}`);
  console.log(`   → در Source هست ولی در مقصد نیست (نیازمند Sync): ${missing.length}`);
  missing.forEach(f => console.log('      +', f, `(${(size(path.join(ROOT, f)) / 1024).toFixed(1)} KB)`));
  console.log(`   → در هر دو هست ولی محتوا متفاوت است: ${newer.length}`);
  newer.forEach(f => console.log('      ~', f));
  console.log(`   → فقط در مقصد هست (قدیمی/اضافه): ${extra.length}`);
  extra.forEach(f => console.log('      -', f));
  const vSrc = (html.match(/var V = '([^']+)'/) || [])[1];
  const vWww = fs.existsSync(path.join(WWW, 'index.html'))
    ? ((fs.readFileSync(path.join(WWW, 'index.html'), 'utf8').match(/var V = '([^']+)'/) || [])[1]) : null;
  console.log(`   نسخه: Source=${vSrc} · pp/www=${vWww} ${vSrc === vWww ? '✔ یکسان' : '✗ متفاوت'}`);
}

console.log('\n۵) حجم منابع قابل ارسال به کاربر');
const runtime = src.filter(f => !f.startsWith('assets/render-3d/'));
const total = runtime.reduce((a, f) => a + size(path.join(ROOT, f)), 0);
const byGrp = {};
runtime.forEach(f => { const g = f.split('/')[0]; byGrp[g] = (byGrp[g] || 0) + size(path.join(ROOT, f)); });
Object.entries(byGrp).sort((a, b) => b[1] - a[1]).forEach(([g, v]) =>
  console.log(`   ${g.padEnd(12)} ${(v / 1024).toFixed(1).padStart(7)} KB`));
console.log(`   ${'TOTAL'.padEnd(12)} ${(total / 1024).toFixed(1).padStart(7)} KB  (بدون ابزار رندر)`);
const tools = src.filter(f => f.startsWith('assets/render-3d/'));
console.log(`   ابزار توسعه (خارج از خروجی اپ): ${tools.length} فایل · ${(tools.reduce((a, f) => a + size(path.join(ROOT, f)), 0) / 1024).toFixed(1)} KB`);

console.log('\n' + '='.repeat(64));
console.log(problems.length || swMissing.length ? '⚠ مواردی برای بررسی وجود دارد' : '✔ مراجع و کش سالم');
