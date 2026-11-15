/** GeoNames cities15000 + yerel alternatif adlardan dünya şehir listesini üretir. */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const BASE = "https://download.geonames.org/export/dump";
const UA = "hakyol.app prayer pages (info@hakyol.app)";
const CONFIG = [
  { cc: "ID", lang: "id", slug: "indonesia", names: { id: "Indonesia" }, method: "kemenag", min: 150000 },
  { cc: "BD", lang: "bn", slug: "bangladesh", names: { bn: "বাংলাদেশ" }, method: "karachi-hanafi", min: 100000 },
  { cc: "PK", lang: "ur", slug: "pakistan", names: { ur: "پاکستان" }, method: "karachi-hanafi", min: 150000 },
  { cc: "SA", lang: "ar", slug: "saudi-arabia", names: { ar: "السعودية" }, method: "umm-al-qura", min: 100000 },
  { cc: "AE", lang: "ar", slug: "uae", names: { ar: "الإمارات" }, method: "dubai", min: 50000 },
  { cc: "QA", lang: "ar", slug: "qatar", names: { ar: "قطر" }, method: "qatar", min: 20000 },
  { cc: "KW", lang: "ar", slug: "kuwait", names: { ar: "الكويت" }, method: "kuwait", min: 20000 },
  { cc: "EG", lang: "ar", slug: "egypt", names: { ar: "مصر" }, method: "egyptian", min: 200000 },
  { cc: "JO", lang: "ar", slug: "jordan", names: { ar: "الأردن" }, method: "jordan", min: 50000 },
  { cc: "IR", lang: "fa", slug: "iran", names: { fa: "ایران" }, method: "tehran", min: 150000 },
  { cc: "AF", lang: "fa", slug: "afghanistan", names: { fa: "افغانستان" }, method: "karachi-hanafi", min: 100000 },
];

const FEATURE_CODES = new Set(["PPLC", "PPLA", "PPLA2", "PPLA3", "PPL"]);
const MANUAL_NAMES = new Map(Object.entries({
  "khulna": "খুলনা", "sylhet": "সিলেট", "jessore": "যশোর", "jashore": "যশোর",
  "cox's bazar": "কক্সবাজার", "kushtia": "কুষ্টিয়া", "natore": "নাটোর",
  "thakurgaon": "ঠাকুরগাঁও", "rangamati": "রাঙ্গামাটি", "narayanganj": "নারায়ণগঞ্জ",
  "abu dhabi": "أبوظبي", "sharjah": "الشارقة", "ras al-khaimah": "رأس الخيمة",
  "kuwait city": "مدينة الكويت", "sanandaj": "سنندج", "gorgan": "گرگان", "abadan": "آبادان",
  "bukan": "بوکان", "urmia": "ارومیه", "kermanshah": "کرمانشاه", "bushehr": "بوشهر",
  "ras al khaimah": "رأس الخيمة", "suez": "السويس", "al mansurah": "المنصورة", "ismailia": "الإسماعيلية",
  "zarqa": "الزرقاء", "ajman": "عجمان", "ajman city": "عجمان", "ar rayyan": "الريان", "bandjarbaru": "Banjarbaru",
}));
// Elle incelemede elenenler (15.11.2026): semt/sanayi bölgesi, kamp, yanlış nüfuslu köy.
const EXCLUDE_IDS = new Set([
  1214189, 1646494, // ID Percut, Cileungsir (Medan/Bogor çevresi kecamatan)
  1163198, // PK Tordher (köy, GeoNames nüfusu hatalı)
  12042053, 11524601, 290503, 8057551, 12042052, 13118439, // AE Musaffah, Jebel Ali, Warsan, Khalifa City A, Bani Yas, Lahbab
  289545, 289716, // QA Umm Ghuwaylinah, Mu'aydhir (Doha semtleri)
  11428685, // JO Rukban (sınır kampı bölgesi)
]);
const REQUIRED = {
  ID: ["Jakarta", "Surabaya", "Bandung", "Medan", "Yogyakarta", "Makassar"],
  BD: ["Dhaka", "Chittagong", "Khulna", "Sylhet"], PK: ["Islamabad", "Karachi", "Lahore"],
  SA: ["Riyadh", "Mecca", "Medina", "Jeddah", "Dammam"],
  AE: ["Abu Dhabi", "Dubai", "Sharjah", "Al Ain", "Ajman"], QA: ["Doha", "Ar Rayyan"], KW: ["Kuwait City"],
  EG: ["Cairo", "Alexandria", "Giza"], JO: ["Amman"],
  IR: ["Tehran", "Mashhad", "Isfahan", "Shiraz", "Tabriz"],
  AF: ["Kabul", "Herat", "Kandahar", "Mazar-i-Sharif"],
};
const COVERAGE_ALIASES = {
  Chittagong: ["Chattogram"], Mecca: ["Makkah"], Medina: ["Madinah"],
  "Al Ain": ["Al Ain City"], Ajman: ["Ajman City"], "Ar Rayyan": ["Al Rayyan"], "Mazar-i-Sharif": ["Mazar-e Sharif"],
};

const slugify = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function download(url, dest) {
  let failure;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(120000) });
      if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
      fs.writeFileSync(dest, Buffer.from(await response.arrayBuffer()));
      return;
    } catch (error) { failure = error; if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1000)); }
  }
  throw failure;
}

function parseCities(text) {
  return text.trim().split("\n").map((line) => {
    const c = line.split("\t");
    return { geonameId: Number(c[0]), name: c[1], asciiname: c[2], lat: Number(c[4]), lng: Number(c[5]), featureCode: c[7], cc: c[8], pop: Number(c[14]), tz: c[17] };
  });
}

function cleanLocalName(value, lang) {
  let name = String(value || "")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "")
    .replace(/\u0671/g, "ا")
    .replace(/[\u200E\u200F]+$/g, "")
    .replace(/^(?:Kota |Kabupaten |Daerah Istimewa |إمارة |محافظة |استان |شهرستان )/, "")
    .split(/[،,]/, 1)[0]
    .replace(/ উপজেলা$/, "")
    .trim();
  if (lang === "fa" || lang === "ur") name = name.replace(/ك/g, "ک").replace(/ي/g, "ی");
  if (lang === "ur") name = name.replace(/لاھور/g, "لاہور");
  return name;
}

function haversineKm(a, b) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const dLat = radians(b.lat - a.lat), dLng = radians(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function removeNearbyCities(cities, protectedNames = new Set()) {
  const sorted = [...cities].sort((a, b) => b.pop - a.pop || a.geonameId - b.geonameId);
  const kept = [];
  for (const city of sorted) {
    const protectedCity = protectedNames.has(city.asciiname.toLowerCase());
    if (!protectedCity && kept.some((larger) => larger.pop > city.pop && haversineKm(city, larger) < 12)) continue;
    kept.push(city);
  }
  return kept;
}

function hasRequiredScript(name, lang) {
  if (lang === "bn") return /[\u0980-\u09FF]/u.test(name);
  if (["ar", "fa", "ur"].includes(lang)) return /[\u0600-\u06FF]/u.test(name);
  return /^[\p{Script=Latin}\p{Number}\p{Punctuation}\p{Separator}]+$/u.test(name);
}

function manualName(city) {
  return MANUAL_NAMES.get(city.name.toLowerCase()) || MANUAL_NAMES.get(city.asciiname.toLowerCase());
}

function parseAlternates(text, lang) {
  const out = new Map();
  for (const line of text.trim().split("\n")) {
    const c = line.split("\t");
    if (c[2] !== lang || c[5] === "1" || c[6] === "1" || c[7] === "1") continue;
    const item = { name: c[3], preferred: c[4] === "1" };
    const previous = out.get(Number(c[1]));
    if (!previous || item.preferred) out.set(Number(c[1]), item);
  }
  return out;
}

function buildCountries(cities, alternatives) {
  return CONFIG.map((cfg) => {
    const used = new Map();
    const names = new Set();
    const protectedNames = new Set(REQUIRED[cfg.cc].flatMap((name) => [name, ...(COVERAGE_ALIASES[name] || [])]).map((name) => name.toLowerCase()));
    const eligible = removeNearbyCities(
      cities.filter((city) => city.cc === cfg.cc && city.pop >= cfg.min && FEATURE_CODES.has(city.featureCode) && !EXCLUDE_IDS.has(Number(city.geonameId))),
      protectedNames,
    );
    const rows = eligible.map((city) => {
      const alt = alternatives[cfg.cc].get(city.geonameId);
      const override = manualName(city);
      if (!alt && !override && cfg.lang !== "id") return null;
      const name = cleanLocalName(override || (alt ? alt.name : city.name), cfg.lang);
      if (!hasRequiredScript(name, cfg.lang) || names.has(name)) return null;
      let slug = slugify(city.asciiname);
      if (!slug) return null;
      const count = used.get(slug) || 0;
      used.set(slug, count + 1);
      if (count) slug += `-${city.geonameId}`;
      names.add(name);
      return { slug, name, asciiName: city.asciiname, geonameId: city.geonameId, lat: city.lat, lng: city.lng, tz: city.tz, pop: city.pop };
    }).filter(Boolean).sort((a, b) => b.pop - a.pop || a.slug.localeCompare(b.slug));
    return { cc: cfg.cc, lang: cfg.lang, slug: cfg.slug, names: cfg.names, method: cfg.method, cities: rows };
  });
}

function assertCoverage(countries) {
  for (const country of countries) {
    const asciiNames = new Set(country.cities.map((city) => city.asciiName.toLowerCase()));
    for (const required of REQUIRED[country.cc]) {
      const accepted = [required, ...(COVERAGE_ALIASES[required] || [])];
      if (!accepted.some((name) => asciiNames.has(name.toLowerCase()))) throw new Error(`${country.cc} zorunlu şehir eksik: ${required}`);
    }
    const slugs = country.cities.map((city) => city.slug);
    if (new Set(slugs).size !== slugs.length) throw new Error(`${country.cc} tekrarlanan slug`);
  }
}

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hakyol-world-"));
  try {
    const citiesZip = path.join(tmp, "cities15000.zip");
    await download(`${BASE}/cities15000.zip`, citiesZip);
    execFileSync("unzip", ["-q", citiesZip, "-d", tmp]);
    const cities = parseCities(fs.readFileSync(path.join(tmp, "cities15000.txt"), "utf8"));
    const alternatives = {};
    for (const cfg of CONFIG) {
      if (alternatives[cfg.cc]) continue;
      const zip = path.join(tmp, `${cfg.cc}.zip`);
      await download(`${BASE}/alternatenames/${cfg.cc}.zip`, zip);
      const listing = execFileSync("unzip", ["-Z1", zip], { encoding: "utf8" }).trim().split("\n");
      const txt = listing.find((name) => /(^|\/)\w{2}\.txt$/i.test(name));
      alternatives[cfg.cc] = parseAlternates(execFileSync("unzip", ["-p", zip, txt], { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 }), cfg.lang);
    }
    const countries = buildCountries(cities, alternatives);
    assertCoverage(countries);
    fs.writeFileSync(path.join(ROOT, "data", "world-cities.json"), JSON.stringify({ countries }, null, 2) + "\n");
    for (const country of countries) console.log(`${country.cc}: ${country.cities.length}`);
    console.log(`Toplam: ${countries.reduce((n, c) => n + c.cities.length, 0)}`);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });
module.exports = { slugify, parseCities, parseAlternates, cleanLocalName, removeNearbyCities, buildCountries, assertCoverage, CONFIG };
