/* hakyol.app — şehir sayfaları için service worker (yalnız /namaz-vakitleri/ kapsamı).
 * Ağ önce; çevrimdışıyken son açılan sayfa önbellekten gelir (aylık vakit tablosu sayfanın içinde). */
var CACHE = "hakyol-vakit-v1";
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", function (e) {
  var r = e.request;
  if (r.method !== "GET" || new URL(r.url).origin !== location.origin) return;
  e.respondWith(
    fetch(r).then(function (res) {
      if (res.ok && (r.mode === "navigate" || /\.(css|js|png|woff2?)$/.test(new URL(r.url).pathname))) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(r, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(r, { ignoreSearch: true });
    })
  );
});
