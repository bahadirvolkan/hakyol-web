/**
 * Diyanet vakitlerini il/ilçe şehir sayfaları için çeker.
 *
 *   node scripts/fetch-vakitler.js [--max-age-days 6] [--only-missing]
 *
 * --only-missing: yalnız bugünü kapsamayan ilçeleri çeker (429 sonrası tamamlama).
 *
 * Kaynak: ezanvakti.emushaf.net — namazvakti.diyanet.gov.tr verisinin aynası,
 * Hakyol uygulamasının da birincil kaynağı (bkz. hakyol/src/services/diyanetPrayerTimes.js).
 * Her ilçe için ~32 günlük tablo döner; haftada bir çekmek yeter. Resmî bir kaynak
 * olmadığı için istekler yavaş ve tek tek atılır; başarısız ilçe eski verisini korur.
 *
 * Girdi:  data/diyanet-tr.json   (il/ilçe kimlikleri)
 * Çıktı:  data/vakitler.json     { fetchedAt, ilce: { <ilceId>: [[iso, imsak, gunes, ogle, ikindi, aksam, yatsi, kible, hicri], ...] } }
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const LIST = path.join(ROOT, "data", "diyanet-tr.json");
const WORLD = path.join(ROOT, "data", "diyanet-dunya.json");
const OUT = path.join(ROOT, "data", "vakitler.json");
const BASE = "https://ezanvakti.emushaf.net";
const DELAY_MS = 1500;
const MAX_FAIL_RATIO = 0.1;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function argMaxAge() {
  const i = process.argv.indexOf("--max-age-days");
  return i === -1 ? 0 : Number(process.argv[i + 1]);
}

async function getJson(p) {
  let attempt = 0;
  while (attempt < 3) {
    try {
      // Varsayılan Node User-Agent'ı 403 alıyor.
      const res = await fetch(BASE + p, {
        headers: { "User-Agent": "hakyol.app city pages (info@hakyol.app)" },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
      return await res.json();
    } catch (e) {
      // 429 normal hata denemesini tüketmez: 60 sn sonra aynı kayıttan devam edilir.
      if (e.status === 429) {
        console.warn(`${p}: HTTP 429, 60 sn bekleniyor`);
        await sleep(60000);
        continue;
      }
      attempt++;
      if (attempt === 3) throw e;
      await sleep(2000 * attempt);
    }
  }
}

function selectIds(tr, world, options = {}) {
  const trIds = tr.flatMap((il) => il.ilceler.map((x) => String(x.ilceId)));
  const worldIds = (world.countries || []).flatMap((country) => country.cities.map((city) => String(city.ilceId)));
  let ids = options.onlyWorld ? worldIds : [...trIds, ...worldIds];
  ids = [...new Set(ids)];
  if (options.onlyMissing) ids = ids.filter((id) => !(options.covered || new Set()).has(id));
  return ids;
}

// "08.11.2026" -> "2026-11-08"
const iso = (d) => d.split(".").reverse().join("-");

function normalizeRows(rows, today) {
  const normalized = rows.map((r) => [
    iso(r.MiladiTarihKisa), r.Imsak, r.Gunes, r.Ogle, r.Ikindi, r.Aksam, r.Yatsi, r.KibleSaati, r.HicriTarihUzun,
  ]);
  const validTime = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value || "");
  if (!normalized.some((row) => row[0] === today) || normalized.some((row) => !row.slice(1, 7).every(validTime))) {
    throw new Error("yanıt bugünü kapsamıyor veya vakit biçimi geçersiz");
  }
  return normalized;
}

async function main() {
  const old = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : null;
  const maxAge = argMaxAge();
  if (old && maxAge > 0) {
    const ageDays = (Date.now() - Date.parse(old.fetchedAt)) / 86400000;
    if (ageDays < maxAge) {
      console.log(`vakitler.json ${ageDays.toFixed(1)} günlük, yenilenmedi (--max-age-days ${maxAge})`);
      return;
    }
  }

  const tr = JSON.parse(fs.readFileSync(LIST, "utf8"));
  const world = fs.existsSync(WORLD) ? JSON.parse(fs.readFileSync(WORLD, "utf8")) : { countries: [] };
  const today = new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10);
  const covered = (id) => old && (old.ilce[id] || []).some((r) => r[0] === today);
  const coveredIds = new Set(old ? Object.keys(old.ilce).filter(covered) : []);
  const ids = selectIds(tr, world, {
    onlyWorld: process.argv.includes("--only-world"),
    onlyMissing: process.argv.includes("--only-missing"), covered: coveredIds,
  });
  const all = selectIds(tr, world);
  const fullRefresh = !process.argv.includes("--only-world") && !process.argv.includes("--only-missing");
  const ilce = old && !fullRefresh ? { ...old.ilce } : {};
  const failed = [];
  for (const [n, id] of ids.entries()) {
    try {
      const rows = await getJson(`/vakitler/${id}`);
      ilce[id] = normalizeRows(rows, today);
    } catch (e) {
      failed.push(id);
      if (old && old.ilce[id]) ilce[id] = old.ilce[id];
      console.warn(`ilçe ${id}: ${e.message}`);
    }
    if ((n + 1) % 10 === 0 || n + 1 === ids.length) console.log(`${n + 1}/${ids.length}`);
    await sleep(DELAY_MS);
  }

  if (failed.length > ids.length * MAX_FAIL_RATIO) {
    console.error(`${failed.length}/${ids.length} ilçe alınamadı, vakitler.json değiştirilmedi`);
    process.exit(1);
  }
  // Eksik tamamlama tam yenileme sayılmaz: fetchedAt eski kalır.
  const fetchedAt = fullRefresh || !old ? new Date().toISOString() : old.fetchedAt;
  fs.writeFileSync(OUT, JSON.stringify({ fetchedAt, ilce }));
  console.log(`vakitler.json: ${ids.length - failed.length}/${ids.length} ilçe güncel`);
}

if (require.main === module) main();
module.exports = { selectIds, normalizeRows };
