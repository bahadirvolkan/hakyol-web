const assert = require("assert");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const ROOT = path.join(__dirname, "..");
const slugify = (name) => name
  .toLocaleLowerCase("tr-TR")
  .replace(/[çğıöşüâîû]/g, (c) => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" })[c])
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const official = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "ilceler-resmi.json"), "utf8"));
const expectedSlugs = new Set(official.map((row) => slugify(row.il)));
const jsonPath = path.join(ROOT, "data", "turkiye-iller.svg.json");
assert(fs.existsSync(jsonPath), "harita JSON'u üretilmeli");

const raw = fs.readFileSync(jsonPath);
const map = JSON.parse(raw);
assert.match(map.viewBox, /^0 0 \d+(?:\.\d+)? \d+(?:\.\d+)?$/);
assert.strictEqual(map.paths.length, 81, "81 il yolu bulunmalı");
assert.deepStrictEqual(new Set(map.paths.map((row) => row.slug)), expectedSlugs, "harita slug'ları 81 resmî ille birebir eşleşmeli");
assert.strictEqual(new Set(map.paths.map((row) => row.slug)).size, 81, "slug'lar benzersiz olmalı");
for (const row of map.paths) {
  assert(row.name && row.slug && /^M/.test(row.d), `geçersiz yol: ${row.slug || row.name}`);
  assert(Number.isFinite(row.lx) && Number.isFinite(row.ly), `${row.slug}: etiket noktası bulunmalı`);
  assert([9, 12, 15].includes(row.ls), `${row.slug}: etiket boyutu üç kademeden biri olmalı`);
  assert(!/\d+\.\d{2,}/.test(row.d), `${row.slug}: koordinatlar en fazla 1 ondalık olmalı`);
}
assert(raw.length <= 70 * 1024, `ham JSON/SVG verisi 70 KB sınırını aşıyor: ${raw.length}`);
assert(zlib.gzipSync(raw).length <= 25 * 1024, "gzip boyutu 25 KB sınırını aşıyor");
console.log(`turkiye haritası: 81 il, ${raw.length} bayt ham, ${zlib.gzipSync(raw).length} bayt gzip`);
