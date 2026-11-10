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
const OUT = path.join(ROOT, "data", "vakitler.json");
const BASE = "https://ezanvakti.emushaf.net";
const DELAY_MS = 500;
const MAX_FAIL_RATIO = 0.1;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function argMaxAge() {
  const i = process.argv.indexOf("--max-age-days");
  return i === -1 ? 0 : Number(process.argv[i + 1]);
}

async function getJson(p) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // Varsayılan Node User-Agent'ı 403 alıyor.
      const res = await fetch(BASE + p, {
        headers: { "User-Agent": "hakyol.app city pages (info@hakyol.app)" },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
      return await res.json();
    } catch (e) {
      if (attempt === 2) throw e;
      // 429: kaynak hız sınırı — uzun bekle.
      await sleep(e.status === 429 ? 60000 : 2000 * (attempt + 1));
    }
  }
}

// "08.11.2026" -> "2026-11-08"
const iso = (d) => d.split(".").reverse().join("-");

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

  const all = JSON.parse(fs.readFileSync(LIST, "utf8")).flatMap((il) => il.ilceler.map((x) => x.ilceId));
  const today = new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10);
  const covered = (id) => old && (old.ilce[id] || []).some((r) => r[0] === today);
  const ids = process.argv.includes("--only-missing") ? all.filter((id) => !covered(id)) : all;
  const ilce = old && ids !== all ? { ...old.ilce } : {};
  const failed = [];
  for (const [n, id] of ids.entries()) {
    try {
      const rows = await getJson(`/vakitler/${id}`);
      ilce[id] = rows.map((r) => [
        iso(r.MiladiTarihKisa), r.Imsak, r.Gunes, r.Ogle, r.Ikindi, r.Aksam, r.Yatsi, r.KibleSaati, r.HicriTarihUzun,
      ]);
    } catch (e) {
      failed.push(id);
      if (old && old.ilce[id]) ilce[id] = old.ilce[id];
      console.warn(`ilçe ${id}: ${e.message}`);
    }
    if ((n + 1) % 100 === 0) console.log(`${n + 1}/${ids.length}`);
    await sleep(DELAY_MS);
  }

  if (failed.length > all.length * MAX_FAIL_RATIO) {
    console.error(`${failed.length}/${ids.length} ilçe alınamadı, vakitler.json değiştirilmedi`);
    process.exit(1);
  }
  // Eksik tamamlama tam yenileme sayılmaz: fetchedAt eski kalır.
  const fetchedAt = ids === all || !old ? new Date().toISOString() : old.fetchedAt;
  fs.writeFileSync(OUT, JSON.stringify({ fetchedAt, ilce }));
  console.log(`vakitler.json: ${ids.length - failed.length}/${ids.length} ilçe güncel`);
}

main();
