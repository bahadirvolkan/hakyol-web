const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const ROOT = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

test("Turkey map data contains an interior label point for all 81 provinces", () => {
  const raw = read("data/turkiye-iller.svg.json");
  const map = JSON.parse(raw);
  assert.equal(map.paths.length, 81);
  for (const province of map.paths) {
    assert.equal(typeof province.lx, "number", `${province.name} lx`);
    assert.equal(typeof province.ly, "number", `${province.name} ly`);
  }
});

test("world map stays within budget and exposes 24 unique active destinations", () => {
  const raw = read("data/dunya-ulkeler.svg.json");
  const map = JSON.parse(raw);
  assert.ok(Buffer.byteLength(raw) <= 60 * 1024);
  assert.ok(zlib.gzipSync(raw).length <= 25 * 1024);
  assert.ok(!map.paths.some((country) => country.iso === "ATA"));

  const svg = read("maps/dunya.svg");
  const links = [...svg.matchAll(/<a[^>]+href="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(links.length, 24);
  assert.equal(new Set(links).size, 24);
  assert.match(svg, /href="\/namaz-vakitleri\/kktc\/"/);
  for (const href of links) assert.ok(fs.existsSync(path.join(ROOT, href, "index.html")), `missing ${href}`);
});

test("world map crops to active region, highlights links and labels only large countries", () => {
  const map = JSON.parse(read("data/dunya-ulkeler.svg.json"));
  const svg = read("maps/dunya.svg");
  assert.equal(map.viewBox, "130 50 675 205");
  assert.match(svg, /\.map-active>path:first-of-type\{fill:rgba\(212,175,55,\.35\);stroke:#d4af37/);
  assert.match(svg, /\.map-marker circle\{fill:#d4af37/);
  const labels = [...svg.matchAll(/<text class="map-label"[^>]*>([^<]+)<\/text>/g)].map((match) => match[1]).sort();
  assert.deepEqual(labels, ["ABD", "Afganistan", "Almanya", "Endonezya", "Fransa", "Mısır", "Pakistan", "S. Arabistan", "Türkiye", "İran", "İsveç"].sort());
  for (const small of ["Hollanda", "Belçika", "İsviçre", "Avusturya", "Danimarka", "KKTC", "Azerbaycan", "Ürdün", "Kuveyt", "Katar", "BAE", "Bangladeş"]) {
    assert.doesNotMatch(svg, new RegExp(`<text[^>]*>${small}<\\/text>`));
    assert.match(svg, new RegExp(`<title>${small}<\\/title>`));
  }
});

test("Turkish home has accessible lazy map tabs and other language homes stay map-free", () => {
  const home = read("index.html");
  assert.match(home, /role="tablist"/);
  assert.match(home, /data-map-src="\/maps\/turkiye\.svg"/);
  assert.match(home, /data-map-src="\/maps\/dunya\.svg"/);
  assert.match(home, /<script src="\/js\/maps\.js" defer><\/script>/);
  for (const lang of ["en", "id", "ar", "bn", "ur", "fa"]) {
    assert.doesNotMatch(read(`${lang}/index.html`), /data-map-src|role="tablist"/);
  }
});
