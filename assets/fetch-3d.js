/* ============================================================
   دانلود + رندر یکپارچه‌ی آسن‌های سه‌بعدی پک «3D Game UI Icons»
   ------------------------------------------------------------
   منبع اصلی و الزامی پروژه:
     https://3dassets.dev/packs/game-ui-icon-library
   اجرا:  node assets/fetch-3d.js
   خروجی: assets/3d/*.webp  (رندر شفاف، زاویه/نور/مقیاس یکسان)

   نکته: تصاویر از روی فایل اصلی GLB رندر می‌شوند (نه از پیش‌نمایش CDN)
   تا همه‌ی آیکون‌ها با یک دوربین، یک نورپردازی و یک مقیاس دیده شوند.
   برای رندر فقط از three.js به‌عنوان ابزار ساخت (خارج از اپ) استفاده می‌شود؛
   خود اپ هیچ موتور سه‌بعدی بارگذاری نمی‌کند.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const TOOL = path.join(ROOT, 'assets', 'render-3d');
const CACHE = path.join(TOOL, '.cache');
const OUT = path.join(ROOT, 'assets', '3d');
const PACK = 'game-ui-icon-library';
const PORT = 8098;

/* [شناسه در CDN, نام فایل, اسلاگ در پک, کاربرد در اپ, اندازه‌ی رندر] */
const ASSETS = [
  [19045, 'portal-ring.webp', 'game-ui-icon-library-portal-ring-cecd690a', 'هیروی صفحه اصلی', 768],
  [19007, 'scroll.webp', 'game-ui-icon-library-scroll-73cdebd0', 'حالت پانتومیم / ضرب المثل', 512],
  [19026, 'explosion.webp', 'game-ui-icon-library-explosion-glyph-5ff2e677', 'حالت بوم', 512],
  [19030, 'lightning.webp', 'game-ui-icon-library-lightning-bolt-27f245be', 'دسته سرعتی', 512],
  [19006, 'book.webp', 'game-ui-icon-library-book-1130def8', 'دسته کلمه / تاریخچه', 512],
  [18981, 'heart.webp', 'game-ui-icon-library-heart-4126fdc7', 'دسته ترانه / درباره', 512],
  [18978, 'token.webp', 'game-ui-icon-library-token-disc-235dc6df', 'انتخاب تصادفی', 512],
  [19012, 'star.webp', 'game-ui-icon-library-star-epic-67dd0d65', 'امتیاز کلمه', 512],
  [19024, 'crosshair.webp', 'game-ui-icon-library-crosshair-6c99c448', 'نوبت سرعتی', 512],
  [18993, 'hourglass.webp', 'game-ui-icon-library-hourglass-9a36b877', 'تنظیم زمان', 512],
  [19014, 'rounds.webp', 'game-ui-icon-library-level-chevron-0af71fb6', 'تعداد دور', 512],
  [18979, 'trophy.webp', 'game-ui-icon-library-trophy-cup-d698f324', 'برنده بازی', 512],
  [18980, 'crown.webp', 'game-ui-icon-library-gold-crown-c9fe939f', 'رتبه اول', 512],
  [19042, 'home.webp', 'game-ui-icon-library-home-marker-72dd3220', 'بازگشت به خانه', 512],
  [19055, 'cog.webp', 'game-ui-icon-library-cog-163073a1', 'تنظیمات', 512]
];

const THREE_FILES = [
  ['https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js', 'three.module.js'],
  ['https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/loaders/GLTFLoader.js', 'GLTFLoader.js'],
  ['https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/utils/BufferGeometryUtils.js', 'utils/BufferGeometryUtils.js'],
  ['https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/environments/RoomEnvironment.js', 'RoomEnvironment.js']
];

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(url + ' → ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  return buf.length;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(CACHE, { recursive: true });

  /* ۱) ابزار رندر (three.js) + مدل‌های اصلی GLB */
  for (const [url, rel] of THREE_FILES) {
    const f = path.join(CACHE, rel);
    if (!fs.existsSync(f)) {
      const n = await download(url, f);
      console.log('tool  ', rel.padEnd(34), Math.round(n / 1024) + ' KB');
    }
  }
  fs.mkdirSync(path.join(CACHE, 'models'), { recursive: true });
  for (const [id] of ASSETS) {
    const f = path.join(CACHE, 'models', id + '.glb');
    if (!fs.existsSync(f)) await download(`https://cdn.3dassets.dev/assets/${id}/v1/model.glb`, f);
  }
  console.log('models', ASSETS.length, 'GLB downloaded');

  /* مسیر داخلی GLTFLoader ��سوی پوشه‌ی محلی اصلاح می‌شود */
  const gltfLoader = path.join(CACHE, 'GLTFLoader.js');
  const src = fs.readFileSync(gltfLoader, 'utf8');
  const patched = src.replace("'../utils/BufferGeometryUtils.js'", "'./utils/BufferGeometryUtils.js'");
  if (patched !== src) { fs.writeFileSync(gltfLoader, patched); console.log('tool   GLTFLoader import path patched'); }

  /* ۲) رندر با ریگ مشترک (دوربین/نور/مقیاس یکسان) */
  const server = spawn(process.execPath, [path.join(TOOL, 'serve.js'), TOOL, String(PORT)], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1500));
  const r = spawnSync(process.execPath, [path.join(TOOL, 'run.js'), OUT], { stdio: 'inherit' });
  server.kill();

  if (r.status !== 0) { console.error('رندر ناموفق بود'); process.exit(1); }

  /* ۳) منشأ و پارامترهای رندر */
  const manifest = ASSETS.map(([id, file, slug, usage, size]) => ({
    file, usage, renderSize: size,
    pack: `https://3dassets.dev/packs/${PACK}`,
    source: `https://3dassets.dev/assets/${slug}`,
    glb: `https://cdn.3dassets.dev/assets/${id}/v1/model.glb`,
    bytes: fs.statSync(path.join(OUT, file)).size
  }));
  fs.writeFileSync(path.join(OUT, 'SOURCES.json'), JSON.stringify({
    catalogue: 'https://3dassets.dev',
    pack: `https://3dassets.dev/packs/${PACK}`,
    license: 'CC0 1.0 Universal — https://creativecommons.org/publicdomain/zero/1.0/',
    note: 'Rendered locally from the original CC0 GLB models with one shared camera / studio-light rig so every icon shares angle, scale, light direction and shadow direction. Transparent WebP, stored locally for offline use. No 3D engine ships in the app.',
    rig: {
      camera: 'PerspectiveCamera fov 26, azimuth -20deg, elevation +15deg (identical for all models)',
      framing: 'Bounding-sphere normalisation — every object gets the same on-screen visual weight',
      lights: 'Key directional (upper-left-front) + violet fill (right) + rim (back) + studio env map + soft contact shadow',
      output: 'Transparent WebP (quality 0.92), sRGB, neutral tone mapping'
    },
    assets: manifest
  }, null, 2));
  console.log('done →', OUT);
})();
