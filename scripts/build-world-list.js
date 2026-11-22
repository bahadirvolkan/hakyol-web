/** GeoNames cities15000 + yerel alternatif adlardan dünya şehir listesini üretir. */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const BASE = "https://download.geonames.org/export/dump";
const UA = "hakyol.app prayer pages (info@hakyol.app)";
const CONFIG = [
  { cc: "ID", lang: "id", slug: "indonesia", names: { id: "Indonesia" }, method: "kemenag", min: 75000 },
  { cc: "BD", lang: "bn", slug: "bangladesh", names: { bn: "বাংলাদেশ" }, method: "karachi-hanafi", min: 50000 },
  { cc: "PK", lang: "ur", slug: "pakistan", names: { ur: "پاکستان" }, method: "karachi-hanafi", min: 50000 },
  { cc: "SA", lang: "ar", slug: "saudi-arabia", names: { ar: "السعودية" }, method: "umm-al-qura", min: 100000 },
  { cc: "AE", lang: "ar", slug: "uae", names: { ar: "الإمارات" }, method: "dubai", min: 50000 },
  { cc: "QA", lang: "ar", slug: "qatar", names: { ar: "قطر" }, method: "qatar", min: 20000 },
  { cc: "KW", lang: "ar", slug: "kuwait", names: { ar: "الكويت" }, method: "kuwait", min: 20000 },
  { cc: "EG", lang: "ar", slug: "egypt", names: { ar: "مصر" }, method: "egyptian", min: 200000 },
  { cc: "JO", lang: "ar", slug: "jordan", names: { ar: "الأردن" }, method: "jordan", min: 50000 },
  { cc: "IR", lang: "fa", slug: "iran", names: { fa: "ایران" }, method: "tehran", min: 40000 },
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
const MANUAL_NAMES_BY_ID = new Map([
  [1183883, "بہاولنگر"],
]);
const BD_ADMIN1 = new Map(Object.entries({
  dhaka: "ঢাকা", chattogram: "চট্টগ্রাম", chittagong: "চট্টগ্রাম", "chôţţogram": "চট্টগ্রাম",
  rajshahi: "রাজশাহী", "rājshāhi": "রাজশাহী", khulna: "খুলনা", barishal: "বরিশাল", barisal: "বরিশাল",
  sylhet: "সিলেট", rangpur: "রংপুর", mymensingh: "ময়মনসিংহ",
}));
// Elle incelemede elenenler (15.11.2026): semt/sanayi bölgesi, kamp, yanlış nüfuslu köy.
const EXCLUDE_IDS = new Set([
  1214189, 1646494, // ID Percut, Cileungsir (Medan/Bogor çevresi kecamatan)
  1163198, // PK Tordher (köy, GeoNames nüfusu hatalı)
  1166547, // PK Sargodha'daki küçük Sahiwal; dump nüfusu gerçek Sahiwal ile karışmış.
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
    return { geonameId: Number(c[0]), name: c[1], asciiname: c[2], lat: Number(c[4]), lng: Number(c[5]), featureCode: c[7], cc: c[8], admin1Code: c[10], pop: Number(c[14]), tz: c[17] };
  });
}

function cleanLocalName(value, lang) {
  let name = String(value || "")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "")
    .replace(/\u0671/g, "ا")
    .replace(/[\u200E\u200F]+$/g, "")
    .replace(/^(?:Kota |Kabupaten |Daerah Istimewa |إمارة |محافظة |استان |شهرستان )/, "")
    .split(/[،,]/, 1)[0]
    .replace(/(?:(?: জেলা| উপজেলা| সদর| ইউনিয়ন| ضلع))+$/, "")
    .trim();
  if (lang === "fa" || lang === "ur") name = name.replace(/ك/g, "ک").replace(/ي/g, "ی");
  if (lang === "ur") name = name.replace(/لاھور/g, "لاہور");
  return name;
}

function cleanAdmin1(value, lang) {
  let name = cleanLocalName(value, lang).replace(/^(?:Propinsi |Provinsi |Daerah Tingkat I )/i, "").trim();
  if (lang === "bn") name = name.replace(/(?: Division| বিভাগ| Bibhag)$/i, "").trim();
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
    const protectedCity = city.featureCode === "PPLA2" || protectedNames.has(city.asciiname.toLowerCase());
    if (!protectedCity && kept.some((larger) => larger.pop > city.pop && haversineKm(city, larger) < 12)) continue;
    kept.push(city);
  }
  return kept;
}

function isEligible(city, cfg = CONFIG.find((x) => x.cc === city.cc)) {
  if (!cfg || !FEATURE_CODES.has(city.featureCode) || EXCLUDE_IDS.has(Number(city.geonameId))) return false;
  if (city.cc === "IR") return ["PPLC", "PPLA"].includes(city.featureCode) || city.pop >= Math.max(10000, cfg.min);
  if (["ID", "PK", "BD", "IR"].includes(city.cc) && ["PPLC", "PPLA", "PPLA2"].includes(city.featureCode)) return true;
  return city.pop >= cfg.min;
}

function reserveStableSlugs(rows, oldRows = []) {
  const valid = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const oldById = new Map(oldRows.filter((x) => valid.test(x.slug)).map((x) => [Number(x.geonameId), x.slug]));
  const used = new Set();
  for (const row of rows) if (oldById.has(Number(row.geonameId))) { row.slug = oldById.get(Number(row.geonameId)); used.add(row.slug); }
  for (const row of rows) {
    if (row.slug) continue;
    const base = slugify(row.asciiName || row.asciiname), admin = slugify(row.admin1Ascii || row.admin1 || "");
    if (!base) throw new Error(`Slug tabanı boş: ${row.geonameId}`);
    let slug = base;
    if (used.has(slug) && admin) slug = `${base}-${admin}`;
    if (used.has(slug)) slug = `${base}-${row.geonameId}`;
    row.slug = slug; used.add(slug);
  }
  return rows;
}

function hasRequiredScript(name, lang) {
  if (lang === "bn") return /[\u0980-\u09FF]/u.test(name);
  if (["ar", "fa", "ur"].includes(lang)) return /[\u0600-\u06FF]/u.test(name);
  return /^[\p{Script=Latin}\p{Number}\p{Punctuation}\p{Separator}]+$/u.test(name);
}

function manualName(city) {
  return MANUAL_NAMES_BY_ID.get(Number(city.geonameId)) || MANUAL_NAMES.get(city.name.toLowerCase()) || MANUAL_NAMES.get(city.asciiname.toLowerCase());
}

function mergeStableCities(cities, stable) {
  const byId = new Map(cities.map((city) => [Number(city.geonameId), city]));
  for (const country of stable.countries || []) for (const old of country.cities || []) {
    const current = byId.get(Number(old.geonameId));
    if (current) Object.assign(current, { name: old.asciiName, asciiname: old.asciiName, lat: old.lat, lng: old.lng, pop: old.pop, tz: old.tz });
    else {
      const restored = { geonameId: old.geonameId, name: old.asciiName, asciiname: old.asciiName, lat: old.lat, lng: old.lng, featureCode: "PPL", cc: country.cc, admin1Code: "", pop: old.pop, tz: old.tz };
      cities.push(restored); byId.set(Number(old.geonameId), restored);
    }
  }
  return cities;
}

function parseAlternates(text, lang) {
  const out = new Map();
  for (const line of text.trim().split("\n")) {
    const c = line.split("\t");
    if (c[2] !== lang) continue;
    const item = { name: c[3], preferred: c[4] === "1" };
    const previous = out.get(Number(c[1]));
    if (!previous || item.preferred) out.set(Number(c[1]), item);
  }
  return out;
}

function buildCountries(cities, alternatives, admin1 = new Map(), previous = { countries: [] }, wikidata = new Map()) {
  return CONFIG.map((cfg) => {
    const oldCountry = previous.countries.find((x) => x.cc === cfg.cc);
    if (!["ID", "PK", "BD", "IR"].includes(cfg.cc) && oldCountry) return oldCountry;
    const used = new Map();
    const protectedNames = new Set(REQUIRED[cfg.cc].flatMap((name) => [name, ...(COVERAGE_ALIASES[name] || [])]).map((name) => name.toLowerCase()));
    const eligible = removeNearbyCities(
      cities.filter((city) => city.cc === cfg.cc && isEligible(city, cfg)),
      protectedNames,
    );
    const missing = { count: 0 };
    const rows = eligible.map((city) => {
      const alt = alternatives[cfg.cc].get(city.geonameId);
      const override = manualName(city);
      const wiki = wikidata.get(city.geonameId);
      if (!alt && !override && !wiki && cfg.lang !== "id") { missing.count++; return null; }
      const name = cleanLocalName(override || (alt ? alt.name : wiki || city.name), cfg.lang);
      if (!hasRequiredScript(name, cfg.lang)) return null;
      const admin = admin1.get(`${city.cc}.${city.admin1Code}`) || {};
      const adminName = cfg.cc === "BD" ? (BD_ADMIN1.get(String(admin.local || "").toLowerCase()) || BD_ADMIN1.get(String(admin.ascii || "").toLowerCase()) || "") : cleanAdmin1(admin.local || admin.ascii || "", cfg.lang);
      return { name, asciiName: city.asciiname, geonameId: city.geonameId, lat: city.lat, lng: city.lng, tz: city.tz, pop: city.pop, admin1: adminName, admin1Ascii: admin.ascii || "" };
    }).filter(Boolean).sort((a, b) => b.pop - a.pop || a.asciiName.localeCompare(b.asciiName));
    reserveStableSlugs(rows, (previous.countries.find((x) => x.cc === cfg.cc) || {}).cities || []);
    return { cc: cfg.cc, lang: cfg.lang, slug: cfg.slug, names: cfg.names, method: cfg.method, missingLocalNames: missing.count, cities: rows };
  });
}

async function fetchWikidataLabels(cache = {}) {
  const query = `SELECT ?country ?geoname ?ur ?bn WHERE {
    VALUES ?country { wd:Q843 wd:Q902 }
    ?item wdt:P17 ?country; wdt:P1566 ?geoname.
    OPTIONAL { ?item rdfs:label ?ur FILTER(LANG(?ur) = "ur") }
    OPTIONAL { ?item rdfs:label ?bn FILTER(LANG(?bn) = "bn") }
  }`;
  const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`;
  const response = await fetch(url, { headers: { "User-Agent": "hakyol-build/1.0", Accept: "application/sparql-results+json" }, signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`Wikidata SPARQL: HTTP ${response.status}`);
  const out = { PK: { ...(cache.PK || {}) }, BD: { ...(cache.BD || {}) } };
  for (const row of (await response.json()).results.bindings) {
    const cc = row.country.value.endsWith("Q843") ? "PK" : "BD", label = row[cc === "PK" ? "ur" : "bn"]?.value;
    if (label && hasRequiredScript(label, cc === "PK" ? "ur" : "bn")) out[cc][row.geoname.value] = label;
  }
  return out;
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
    const stable = JSON.parse(fs.readFileSync(path.join(ROOT, "test", "fixtures", "world-cities-2026-11-22.json"), "utf8"));
    const previous = stable;
    const citiesZip = path.join(tmp, "cities500.zip");
    await download(`${BASE}/cities500.zip`, citiesZip);
    execFileSync("unzip", ["-q", citiesZip, "-d", tmp]);
    const cities = mergeStableCities(parseCities(fs.readFileSync(path.join(tmp, "cities500.txt"), "utf8")), stable);
    const alternatives = {};
    for (const cfg of CONFIG) {
      if (alternatives[cfg.cc]) continue;
      const zip = path.join(tmp, `${cfg.cc}.zip`);
      await download(`${BASE}/alternatenames/${cfg.cc}.zip`, zip);
      const listing = execFileSync("unzip", ["-Z1", zip], { encoding: "utf8" }).trim().split("\n");
      const txt = listing.find((name) => /(^|\/)\w{2}\.txt$/i.test(name));
      alternatives[cfg.cc] = parseAlternates(execFileSync("unzip", ["-p", zip, txt], { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 }), cfg.lang);
    }
    const adminText = await (await fetch(`${BASE}/admin1CodesASCII.txt`, { headers: { "User-Agent": UA } })).text();
    const admin1 = new Map(adminText.trim().split("\n").map((line) => { const c = line.split("\t"), cc = c[0].slice(0, 2), alt = alternatives[cc] && alternatives[cc].get(Number(c[3])); return [c[0], { ascii: c[2], local: alt ? cleanLocalName(alt.name, (CONFIG.find((x) => x.cc === cc) || {}).lang) : c[1] }]; }));
    const wikiFile = path.join(ROOT, "data", "wikidata-world-labels.json");
    const wikiCache = fs.existsSync(wikiFile) ? JSON.parse(fs.readFileSync(wikiFile, "utf8")) : {};
    const wiki = process.env.HAKYOL_WIKIDATA_CACHE_ONLY === "1" ? wikiCache : await fetchWikidataLabels(wikiCache);
    fs.writeFileSync(wikiFile, JSON.stringify(wiki, null, 2) + "\n");
    const wikiMap = new Map([...Object.entries(wiki.PK || {}), ...Object.entries(wiki.BD || {})].map(([id, label]) => [Number(id), label]));
    const countries = buildCountries(cities, alternatives, admin1, previous, wikiMap);
    assertCoverage(countries);
    fs.writeFileSync(path.join(ROOT, "data", "world-cities.json"), JSON.stringify({ countries }, null, 2) + "\n");
    for (const country of countries) console.log(`${country.cc}: ${country.cities.length} (eski ${(previous.countries.find((x) => x.cc === country.cc) || { cities: [] }).cities.length}, yerel ad eksik ${country.missingLocalNames})`);
    console.log(`Toplam: ${countries.reduce((n, c) => n + c.cities.length, 0)}`);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });
module.exports = { slugify, parseCities, parseAlternates, cleanLocalName, cleanAdmin1, removeNearbyCities, isEligible, reserveStableSlugs, mergeStableCities, buildCountries, fetchWikidataLabels, assertCoverage, CONFIG };
