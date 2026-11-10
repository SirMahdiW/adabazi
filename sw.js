/* سرویس‌ورکر ادابازی — کش برای کار آفلاین */
var CACHE = 'adabazi-v2';

var ASSETS = [
  './',
  'index.html',
  'css/tokens.css',
  'css/app.css',
  'js/icons.js',
  'js/store.js',
  'js/audio.js',
  'js/data.js',
  'js/confetti.js',
  'js/game.js',
  'js/app.js',
  'manifest.json',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'data/words.json'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);

  // فونت‌ها: کش با پس‌زمینه (stale-while-revalidate)
  if (url.origin !== location.origin) {
    e.respondWith(
      caches.match(req).then(function (hit) {
        var net = fetch(req).then(function (res) {
          if (res && res.status === 200) {
            caches.open(CACHE).then(function (c) { c.put(req, res.clone()); });
          }
          return res;
        }).catch(function () { return hit; });
        return hit || net;
      })
    );
    return;
  }

  // محتوای خود اپ: کش اول، سپس شبکه با به‌روزرسانی
  e.respondWith(
    caches.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          caches.open(CACHE).then(function (c) { c.put(req, res.clone()); });
        }
        return res;
      }).catch(function () {
        return hit || caches.match('index.html');
      });
      return hit || net;
    })
  );
});
