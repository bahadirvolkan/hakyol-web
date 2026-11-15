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

function allRings(geometry) {
  if (geometry.type === "Polygon") return geometry.coordinates;
  if (geometry.type === "MultiPolygon") return geometry.coordinates.flat();
  throw new Error(`Beklenmeyen geometri: ${geometry.type}`);
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
      return { ...province, rings: allRings(feature.geometry) };
    });
    if (matched.length !== 81 || new Set(matched.map((item) => item.slug)).size !== 81) {
      throw new Error(`Harita eşleşmesi 81 benzersiz il değil: ${matched.length}`);
    }

    const points = matched.flatMap((item) => item.rings.flat());
    const xs = points.map(([lon]) => lon * COS_39);
    const ys = points.map(([, lat]) => -lat);
    const minX = Math.min(...xs), minY = Math.min(...ys);
    const scale = 100;
    const project = ([lon, lat]) => [(lon * COS_39 - minX) * scale, (-lat - minY) * scale];
    let maxX = 0, maxY = 0;
    const paths = matched.map(({ slug, name, rings }) => {
      const d = rings.map((ring) => ring.map((point, index) => {
        const [x, y] = project(point); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        return `${index ? "L" : "M"}${number(x)} ${number(y)}`;
      }).join("") + "Z").join("");
      return { slug, name, d };
    }).sort((a, b) => a.name.localeCompare(b.name, "tr"));

    const output = JSON.stringify({ viewBox: `0 0 ${number(maxX)} ${number(maxY)}`, paths }) + "\n";
    const rawBytes = Buffer.byteLength(output), gzipBytes = zlib.gzipSync(output).length;
    if (rawBytes > 70 * 1024 || gzipBytes > 25 * 1024) {
      throw new Error(`SVG verisi boyut sınırını aşıyor: ${rawBytes} ham, ${gzipBytes} gzip`);
    }
    fs.writeFileSync(OUT, output);
    console.log(`Türkiye haritası: ${paths.length} eşleşme, ${rawBytes} bayt ham, ${gzipBytes} bayt gzip`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error.message); process.exit(1); });
