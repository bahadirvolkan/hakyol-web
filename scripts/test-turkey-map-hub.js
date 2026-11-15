const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const hub = fs.readFileSync(path.join(ROOT, "namaz-vakitleri", "index.html"), "utf8");
const section = hub.match(/<div class="turkey-map"[\s\S]*?<\/div>/);
assert(section, "hub harita bölümü içermeli");
assert.match(section[0], /<svg[^>]+role="img"[^>]+aria-label="Türkiye il haritası"/);
const links = [...section[0].matchAll(/<a href="\/namaz-vakitleri\/([^/]+)\/"/g)];
assert.strictEqual(links.length, 81, "haritada 81 il bağlantısı olmalı");
assert.strictEqual(new Set(links.map((match) => match[1])).size, 81, "harita bağlantıları benzersiz olmalı");
for (const [, slug] of links) {
  assert(fs.existsSync(path.join(ROOT, "namaz-vakitleri", slug, "index.html")), `${slug} sayfası bulunmalı`);
}
assert.match(hub, /<script src="\/js\/turkey-map\.js" defer><\/script>/);
assert.match(hub, /<link rel="stylesheet" href="\/css\/turkey-map\.css" \/>/);
const province = fs.readFileSync(path.join(ROOT, "namaz-vakitleri", "ankara", "index.html"), "utf8");
assert(!province.includes('class="turkey-map"'), "harita il sayfalarına eklenmemeli");
console.log("hub haritası: 81 benzersiz bağlantı ve 81 dosya doğrulandı");
