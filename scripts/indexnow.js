/**
 * IndexNow: değişen sayfaları Bing, Yandex ve diğer katılımcı arama motorlarına anında bildirir.
 * (Google IndexNow'u desteklemez; Google için Search Console site haritası.)
 *
 *   node scripts/indexnow.js
 *
 * Anahtar dosyası sitenin kökünde <anahtar>.txt olarak yayında olmalı.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const KEY = fs.readFileSync(path.join(__dirname, "indexnow-key.txt"), "utf8").trim();
const HOST = "hakyol.app";

const urls = ["sitemap.xml", "sitemap-namaz.xml"]
  .filter((f) => fs.existsSync(path.join(ROOT, f)))
  .flatMap((f) => [...fs.readFileSync(path.join(ROOT, f), "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));

fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls }),
}).then((res) => {
  console.log(`IndexNow: ${urls.length} adres, HTTP ${res.status}`);
  if (res.status >= 400) process.exitCode = 1;
});
