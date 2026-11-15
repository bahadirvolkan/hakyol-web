/** Diyanet dünya ilçelerini GeoNames cities15000 nüfusuyla eşleyip data/diyanet-dunya.json üretir. */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const BASE = "https://ezanvakti.emushaf.net";
const UA = "hakyol.app city pages (info@hakyol.app)";
const DELAY_MS = 1500;
const GEONAMES = "https://download.geonames.org/export/dump/cities15000.zip";
const COUNTRIES = [
  ["ALMANYA", "almanya", "Almanya", "DE", 80],
  ["HOLLANDA", "hollanda", "Hollanda", "NL", 25],
  ["BELÇİKA", "belcika", "Belçika", "BE", 15],
  ["FRANSA", "fransa", "Fransa", "FR", 30],
  ["AVUSTURYA", "avusturya", "Avusturya", "AT", 15],
  ["İSVİÇRE", "isvicre", "İsviçre", "CH", 15],
  ["BİRLEŞİK KRALLIK", "ingiltere", "İngiltere", "GB", 15],
  ["AMERİKA BİRLEŞİK DEVLETLERİ", "abd", "ABD", "US", 25],
  ["KUZEY KIBRIS", "kktc", "KKTC", "CY", Infinity],
  ["AZERBAYCAN", "azerbaycan", "Azerbaycan", "AZ", 10],
  ["İSVEÇ", "isvec", "İsveç", "SE", 8],
  ["DANİMARKA", "danimarka", "Danimarka", "DK", 6],
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const fold = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/ß/g, "ss").replace(/ı/g, "i").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const slugify = (value) => fold(value).replace(/ /g, "-");

function aliases(city) {
  return new Set([city.name, city.asciiname, ...(city.alternatenames || "").split(",")].map(fold).filter(Boolean));
}

// Türkçe sayfada yerleşik Türkçe adlar (GeoNames adı → Türkçe). Asıl ad arama için alias olarak kalır.
const TR_NAMES = {
  Munich: "Münih", "München": "Münih", Nuremberg: "Nürnberg", "Frankfurt am Main": "Frankfurt",
  "Ludwigshafen am Rhein": "Ludwigshafen", "Halle (Saale)": "Halle", Vienna: "Viyana",
  "Klagenfurt am Wörthersee": "Klagenfurt", Geneva: "Cenevre", "Zürich": "Zürih", "Sankt Gallen": "St. Gallen",
  "Biel/Bienne": "Biel", Brussels: "Brüksel", Antwerp: "Anvers", Ostend: "Ostende", "The Hague": "Lahey",
  "Almere Stad": "Almere", Marseille: "Marsilya", Strasbourg: "Strazburg", London: "Londra",
  Edinburgh: "Edinburg", "New York City": "New York", Copenhagen: "Kopenhag", "Århus": "Aarhus",
  Gothenburg: "Göteborg", Baku: "Bakü", Ganja: "Gence", Sumgayit: "Sumgayıt", Mingachevir: "Mingeçevir",
  "Naxçıvan": "Nahçıvan", Sheki: "Şeki", Shamakhi: "Şamahı", Yevlakh: "Yevlah",
};
// Şehir değil semt/ilçe (ana şehirle çift) ya da yanlış eşleşme.
const EXCLUDE = new Set(["Brooklyn", "Harburg", "Bergedorf", "Lend", "Maştağa"]);
// KKTC: Diyanet adlarıyla elle; Güney Kıbrıs (Baf, Larnaka, Leymosun) ve ara bölge (Pile) yok.
const KKTC = [
  ["LEFKOSA", "Lefkoşa", 35.1856, 33.3823], ["GAZI MAGOSA", "Gazimağusa", 35.125, 33.9417],
  ["GIRNE", "Girne", 35.3364, 33.3192], ["GUZELYURT", "Güzelyurt", 35.1983, 32.9933],
  ["ISKELE", "İskele", 35.2869, 33.8919], ["LEFKE", "Lefke", 35.1108, 32.8497],
  ["DIPKARPAZ", "Dipkarpaz", 35.6, 34.38],
];

function localize(city) {
  if (EXCLUDE.has(city.name)) return null;
  const tr = TR_NAMES[city.name];
  if (!tr) return city;
  return { ...city, slug: slugify(tr), name: tr, alias: city.alias || city.name };
}

function kktcCities(districts) {
  return KKTC.map(([src, name, lat, lng]) => {
    const d = districts.find((x) => x.IlceAdi === src);
    if (!d) throw new Error(`KKTC ilçesi yok: ${src}`);
    return { slug: slugify(name), name, ilceId: String(d.IlceID), pop: 0, lat, lng };
  });
}

function matchCities(districts, geonames, limit) {
  const byAlias = new Map();
  for (const city of geonames) for (const alias of aliases(city)) {
    const previous = byAlias.get(alias);
    if (!previous || city.population > previous.population) byAlias.set(alias, city);
  }
  const used = new Set();
  const matched = [];
  for (const district of districts) {
    const city = byAlias.get(fold(district.IlceAdi));
    if (!city || used.has(city.geonameid || city)) continue;
    used.add(city.geonameid || city);
    const item = localize({
      slug: slugify(city.name), name: city.name, ilceId: String(district.IlceID),
      pop: Number(city.population), lat: Number(city.lat), lng: Number(city.lng),
    });
    if (item) matched.push(item);
  }
  return matched.sort((a, b) => b.pop - a.pop || a.name.localeCompare(b.name)).slice(0, limit);
}

let lastRequestAt = 0;
async function getJson(endpoint) {
  const wait = DELAY_MS - (Date.now() - lastRequestAt);
  if (wait > 0) await sleep(wait);
  for (;;) {
    lastRequestAt = Date.now();
    const response = await fetch(BASE + endpoint, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30000) });
    if (response.status === 429) { await sleep(60000); continue; }
    if (!response.ok) throw new Error(`${endpoint}: HTTP ${response.status}`);
    return response.json();
  }
}

async function loadGeoNames() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hakyol-geonames-"));
  const zip = path.join(tmp, "cities15000.zip");
  const response = await fetch(GEONAMES, { headers: { "User-Agent": UA } });
  if (!response.ok) throw new Error(`GeoNames: HTTP ${response.status}`);
  fs.writeFileSync(zip, Buffer.from(await response.arrayBuffer()));
  execFileSync("unzip", ["-q", zip, "-d", tmp]);
  const rows = fs.readFileSync(path.join(tmp, "cities15000.txt"), "utf8").trim().split("\n").map((line) => {
    const c = line.split("\t");
    return { geonameid: c[0], name: c[1], asciiname: c[2], alternatenames: c[3], lat: c[4], lng: c[5], country: c[8], population: Number(c[14]) };
  });
  fs.rmSync(tmp, { recursive: true, force: true });
  return rows;
}

async function main() {
  const [ulkeler, geo] = await Promise.all([getJson("/ulkeler"), loadGeoNames()]);
  const countries = [];
  for (const [sourceName, slug, name, cc, limit] of COUNTRIES) {
    const country = ulkeler.find((item) => item.UlkeAdi === sourceName);
    if (!country) throw new Error(`Diyanet ülkesi bulunamadı: ${sourceName}`);
    const sehirler = await getJson(`/sehirler/${country.UlkeID}`);
    const districts = [];
    for (const sehir of sehirler) districts.push(...await getJson(`/ilceler/${sehir.SehirID}`));
    const cities = slug === "kktc" ? kktcCities(districts) : matchCities(districts, geo.filter((city) => city.country === cc), limit);
    countries.push({ slug, name, ulkeId: String(country.UlkeID), cities });
    console.log(`${name}: ${cities.length}`);
  }
  fs.writeFileSync(path.join(ROOT, "data", "diyanet-dunya.json"), JSON.stringify({ generated: new Date().toISOString(), countries }, null, 2) + "\n");
}

if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });
module.exports = { slugify, matchCities, localize };
