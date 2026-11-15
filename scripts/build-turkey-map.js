#!/usr/bin/env node
const fs = require("fs");
const https = require("https");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const zlib = require("zlib");

const ROOT = path.join(__dirname, "..");
const SOURCE = "https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_1_states_provinces.zip";
const OUT = path.join(ROOT, "data", "turkiye-iller.svg.json");
const SVG_OUT = path.join(ROOT, "maps", "turkiye.svg");
const COS_39 = Math.cos(39 * Math.PI / 180);
const MANUAL_NAMES = {
  // Natural Earth name_tr alanı değişirse yalnız gerçek ad farklılıklarını buraya ekle.
};

function normalizeName(value) {
  return String(value || "").toLocaleLowerCase("tr-TR").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i")
    .replace(/[^a-z0-9]/g, "");
}

function slugify(name) {
  return name.toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşüâîû]/g, (c) => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" })[c])
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return download(new URL(res.headers.location, url).href, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`Natural Earth indirme hatası: HTTP ${res.statusCode}`));
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on("finish", () => file.close(resolve));
      file.on("error", reject);
    }).on("error", reject);
  });
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.status !== 0) throw new Error(`${command} başarısız oldu (${result.status})`);
}

function polygons(geometry) {
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  throw new Error(`Beklenmeyen geometri: ${geometry.type}`);
}

function pointToPolygonDistance(x, y, polygon) {
  let inside = false, min = Infinity;
  for (const ring of polygon) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = dx || dy ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy))) : 0;
    min = Math.min(min, (x - (a[0] + dx * t)) ** 2 + (y - (a[1] + dy * t)) ** 2);
  }
  return (inside ? 1 : -1) * Math.sqrt(min);
}

function polylabel(polygon, precision = 0.5) {
  const outer = polygon[0];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of outer) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  const size = Math.min(maxX - minX, maxY - minY), cells = [];
  const cell = (x, y, h) => { const d = pointToPolygonDistance(x, y, polygon); return { x, y, h, d, max: d + h * Math.SQRT2 }; };
  if (!size) return cell(minX, minY, 0);
  for (let x = minX; x < maxX; x += size) for (let y = minY; y < maxY; y += size) cells.push(cell(x + size / 2, y + size / 2, size / 2));
  let best = cell(outer.reduce((n, p) => n + p[0], 0) / outer.length, outer.reduce((n, p) => n + p[1], 0) / outer.length, 0);
  while (cells.length) {
    cells.sort((a, b) => a.max - b.max);
    const current = cells.pop();
    if (current.d > best.d) best = current;
    if (current.max - best.d <= precision) continue;
    const h = current.h / 2;
    cells.push(cell(current.x - h, current.y - h, h), cell(current.x + h, current.y - h, h), cell(current.x - h, current.y + h, h), cell(current.x + h, current.y + h, h));
  }
  return best;
}

function number(value) {
  const rounded = Math.round(value * 10) / 10;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hakyol-turkey-map-"));
  try {
    const zip = path.join(tmp, "natural-earth.zip");
    const sourceDir = path.join(tmp, "source");
    const geojson = path.join(tmp, "turkey.geojson");
    fs.mkdirSync(sourceDir);
    await download(SOURCE, zip);
    run("unzip", ["-q", zip, "-d", sourceDir]);
    const shp = path.join(sourceDir, "ne_10m_admin_1_states_provinces.shp");
    run("npx", ["--yes", "mapshaper", shp, "-filter", 'adm0_a3 == "TUR"', "-simplify", "8%", "keep-shapes", "weighted", "-o", "format=geojson", "precision=0.0001", geojson], {
      env: { ...process.env, NPM_CONFIG_CACHE: process.env.NPM_CONFIG_CACHE || path.join(os.tmpdir(), "hakyol-npm-cache") },
    });

    const officialRows = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "ilceler-resmi.json"), "utf8"));
    const provinces = new Map();
    for (const row of officialRows) provinces.set(normalizeName(row.il), { name: row.il, slug: slugify(row.il) });
    if (provinces.size !== 81) throw new Error(`Kaynak il listesi 81 değil: ${provinces.size}`);

    const features = JSON.parse(fs.readFileSync(geojson, "utf8")).features;
    const matched = features.map((feature) => {
      const p = feature.properties;
      const candidates = [MANUAL_NAMES[p.name], p.name_tr, p.name, ...(p.name_alt || "").split("|")].filter(Boolean);
      const province = candidates.map((name) => provinces.get(normalizeName(name))).find(Boolean);
      if (!province) throw new Error(`Eşleşmeyen Natural Earth ili: ${p.name} / ${p.name_tr || "-"}`);
      return { ...province, polygons: polygons(feature.geometry) };
    });
    if (matched.length !== 81 || new Set(matched.map((item) => item.slug)).size !== 81) {
      throw new Error(`Harita eşleşmesi 81 benzersiz il değil: ${matched.length}`);
    }

    const points = matched.flatMap((item) => item.polygons.flat(2));
    const xs = points.map(([lon]) => lon * COS_39);
    const ys = points.map(([, lat]) => -lat);
    const minX = Math.min(...xs), minY = Math.min(...ys);
    const scale = 100;
    const project = ([lon, lat]) => [(lon * COS_39 - minX) * scale, (-lat - minY) * scale];
    let maxX = 0, maxY = 0;
    const paths = matched.map(({ slug, name, polygons: provincePolygons }) => {
      const projected = provincePolygons.map((polygon) => polygon.map((ring) => ring.map(project)));
      const rings = projected.flat();
      const d = rings.map((ring) => ring.map((point, index) => {
        const [x, y] = point; maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        return `${index ? "L" : "M"}${number(x)} ${number(y)}`;
      }).join("") + "Z").join("");
      const label = projected.map((polygon) => polylabel(polygon)).sort((a, b) => b.d - a.d)[0];
      const fit = Math.floor(label.d * 2 / Math.max(3, name.length * 0.58));
      const ls = fit >= 15 ? 15 : fit >= 12 ? 12 : 9;
      return { slug, name, d, lx: +number(label.x), ly: +number(label.y), ls };
    }).sort((a, b) => a.name.localeCompare(b.name, "tr"));

    const output = JSON.stringify({ viewBox: `0 0 ${number(maxX)} ${number(maxY)}`, paths }) + "\n";
    const rawBytes = Buffer.byteLength(output), gzipBytes = zlib.gzipSync(output).length;
    if (rawBytes > 70 * 1024 || gzipBytes > 25 * 1024) {
      throw new Error(`SVG verisi boyut sınırını aşıyor: ${rawBytes} ham, ${gzipBytes} gzip`);
    }
    fs.writeFileSync(OUT, output);
    fs.mkdirSync(path.dirname(SVG_OUT), { recursive: true });
    const svgBody = paths.map((item) => `<a class="map-country map-active" href="/namaz-vakitleri/${item.slug}/" aria-label="${item.name} namaz vakitleri" data-map-name="${item.name}"><path d="${item.d}"/><text class="map-label map-label-${item.ls}" x="${item.lx}" y="${item.ly}">${item.name}</text></a>`).join("");
    fs.writeFileSync(SVG_OUT, `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Türkiye il haritası" viewBox="0 0 ${number(maxX)} ${number(maxY)}"><style>.map-country path{fill:#1b2740;stroke:#675b36;stroke-width:.8}.map-label{fill:#fff4d6;stroke:#08101e;stroke-width:2.4px;paint-order:stroke;pointer-events:none;text-anchor:middle;dominant-baseline:middle;font:600 12px system-ui}.map-label-9{font-size:9px}.map-label-15{font-size:15px}.map-country:hover path,.map-country:focus path{fill:#756126;stroke:#d4af37}.map-country:hover .map-label,.map-country:focus .map-label{fill:#f1d477}</style>${svgBody}</svg>\n`);
    console.log(`Türkiye haritası: ${paths.length} eşleşme, ${rawBytes} bayt ham, ${gzipBytes} bayt gzip`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error.message); process.exit(1); });
