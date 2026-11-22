/** Başkentler ve 10 genişletilmiş ID şehri için sonuçları bağımsız AlAdhan API ile karşılaştırır. */
const path = require("path");
const DATA = require("../data/world-cities.json");
const { calculateTimes } = require("../build-world");

const CAPITAL = { ID: "Jakarta", BD: "Dhaka", PK: "Islamabad", SA: "Riyadh", AE: "Abu Dhabi", QA: "Doha", KW: "Kuwait City", EG: "Cairo", JO: "Amman", IR: "Tehran", AF: "Kabul" };
const METHOD = { ID: 20, BD: 1, PK: 1, SA: 4, AE: 16, QA: 10, KW: 9, EG: 5, JO: 23, IR: 7, AF: 1 };
const KEYS = { fajr: "Fajr", sunrise: "Sunrise", dhuhr: "Dhuhr", asr: "Asr", maghrib: "Maghrib", isha: "Isha" };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const iso = (d) => d.toISOString().slice(0, 10);
const apiDate = (ymd) => `${ymd.slice(8, 10)}-${ymd.slice(5, 7)}-${ymd.slice(0, 4)}`;
const minutes = (time) => { const p = time.match(/\d{1,2}:\d{2}/)[0].split(":").map(Number); return p[0] * 60 + p[1]; };
const difference = (a, b) => { const n = Math.abs(minutes(a) - minutes(b)); return Math.min(n, 1440 - n); };
const shift = (time, delta) => { const n = (minutes(time) + delta + 1440) % 1440; return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`; };

async function fetchApi(country, city, ymd) {
  const school = country.method === "karachi-hanafi" ? 1 : 0;
  const query = new URLSearchParams({ latitude: city.lat, longitude: city.lng, method: METHOD[country.cc], school, timezonestring: city.tz });
  const url = `https://api.aladhan.com/v1/timings/${apiDate(ymd)}?${query}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${country.cc}/${city.slug}: HTTP ${response.status}`);
  const json = await response.json();
  if (json.code !== 200) throw new Error(`${country.cc}/${city.slug}: ${json.status}`);
  return json.data.timings;
}

async function main() {
  const start = new Date(`${iso(new Date())}T12:00:00Z`), dates = [iso(start), iso(new Date(start.getTime() + 15 * 86400000))];
  let largest = 0, failures = 0;
  console.log("CC  Şehir                 Tarih       En büyük fark");
  console.log("--  -------------------- ---------- -------------");
  for (const country of DATA.countries) {
    const capital = country.cities.find((c) => c.asciiName.toLowerCase() === CAPITAL[country.cc].toLowerCase());
    if (!capital) throw new Error(`${country.cc} başkenti bulunamadı: ${CAPITAL[country.cc]}`);
    const unique = [capital, ...country.cities].filter((city, i, all) => all.findIndex((x) => x.geonameId === city.geonameId) === i);
    const cities = country.cc === "ID"
      ? unique.slice().sort((a, b) => ((a.geonameId * 2654435761) >>> 0) - ((b.geonameId * 2654435761) >>> 0)).slice(0, 10)
      : unique.slice(0, 3);
    for (const city of cities) for (const ymd of dates) {
      const local = calculateTimes(country, city, ymd), api = await fetchApi(country, city, ymd);
      // Kemenag sayfaları şartname gereği API'nin çıplak 20°/18° sonucuna ihtiyat uygular.
      if (country.method === "kemenag") for (const apiKey of Object.values(KEYS)) api[apiKey] = shift(api[apiKey], apiKey === "Sunrise" ? -2 : 2);
      let max = 0;
      for (const [key, apiKey] of Object.entries(KEYS)) max = Math.max(max, difference(local[key], api[apiKey]));
      largest = Math.max(largest, max); if (max > 2) failures++;
      console.log(`${country.cc.padEnd(3)} ${city.asciiName.slice(0, 20).padEnd(20)} ${ymd} ${String(max).padStart(2)} dk${max > 2 ? "  FAIL" : ""}`);
      await sleep(1000);
    }
  }
  console.log(`En büyük fark: ${largest} dk; eşik dışı: ${failures}`);
  if (failures) process.exitCode = 1;
}

if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });
module.exports = { difference };
