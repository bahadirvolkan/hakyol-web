const test = require("node:test");
const assert = require("node:assert/strict");
const { renderCityPage, imsakiyeUrl, buildWorldRows } = require("../build-imsakiye");

function ramadanRows() {
  return Array.from({ length: 29 }, (_, i) => ({
    ymd: new Date(Date.UTC(2027, 1, 8 + i)).toISOString().slice(0, 10),
    imsak: "06:18", fajr: "06:28", sunrise: "07:20", dhuhr: "13:00", asr: "16:00", maghrib: "18:23", isha: "19:45", source: "calculated", hijri: String(i + 1),
  }));
}

test("şehir URL'leri dil sözleşmesine uyar", () => {
  assert.equal(imsakiyeUrl("tr", { slug: "ankara" }), "/imsakiye/ankara/");
  assert.equal(imsakiyeUrl("tr", { slug: "berlin", countrySlug: "almanya" }), "/imsakiye/almanya/berlin/");
  assert.equal(imsakiyeUrl("id", { slug: "jakarta" }), "/id/jadwal-imsakiyah/jakarta/");
  assert.equal(imsakiyeUrl("ar", { slug: "riyadh" }), "/ar/imsakiya/riyadh/");
});

test("dünya imsakiye satırı mevcut dünya hesaplayıcısıyla aynıdır ve ID imsak 10 dakika erkendir", () => {
  const country = { lang: "id", method: "kemenag" }, city = { lat: -6.21462, lng: 106.84513, tz: "Asia/Jakarta" };
  const row = buildWorldRows(country, city, ["2027-02-08"])[0];
  assert.deepEqual(row, { ymd: "2027-02-08", imsak: "04:28", fajr: "04:38", sunrise: "05:54", dhuhr: "12:09", asr: "15:26", maghrib: "18:19", isha: "19:31", source: "calculated", hijri: "1" });
});

test("10 sabit dünya şehrinde imsakiye satırı dünya üreticisinin hesabıyla aynıdır", () => {
  const data = require("../data/world-cities.json"), { calculateTimes } = require("../build-world");
  const samples = data.countries.flatMap((country) => country.cities.slice(0, 1).map((city) => [country, city])).slice(0, 10);
  for (const [country, city] of samples) {
    const got = buildWorldRows(country, city, ["2027-02-08"])[0], want = calculateTimes(country, city, "2027-02-08");
    assert.equal(got.imsak, want.imsak || want.fajr, `${country.cc}/${city.slug}/imsak`);
    for (const key of ["sunrise", "dhuhr", "asr", "maghrib", "isha"]) assert.equal(got[key], want[key], `${country.cc}/${city.slug}/${key}`);
  }
});

test("şehir HTML'i SEO, erişilebilir tablo, yazdırma, FAQ ve dürüst kaynak içerir", () => {
  const rows = [{ ymd: "2027-02-08", imsak: "06:00", sunrise: "07:20", dhuhr: "13:00", asr: "16:00", maghrib: "18:30", isha: "19:45", source: "calculated", hijri: "1 Ramazan 1448" }];
  const html = renderCityPage({ lang: "tr", city: { name: "Ankara", slug: "ankara" }, url: "/imsakiye/ankara/", rows, nearby: [], prayerUrl: "/namaz-vakitleri/ankara/", buildDate: "2026-11-22" });
  assert.match(html, /<title>Ankara İmsakiye 2027 — Ramazan Sahur ve İftar Vakitleri \| Hakyol<\/title>/);
  assert.match(html, /Diyanet verisi yayımlanınca otomatik güncellenir/);
  assert.doesNotMatch(html, /Kaynak: Diyanet İşleri Başkanlığı/);
  assert.match(html, /FAQPage/);
  assert.match(html, /@media print/);
  assert.match(html, /window\.print/);
  assert.match(html, /overflow-x:auto/);
});

test("Kadir notu rows[25] tarihini gösterir ve 26. gün satırı vurgulanır", () => {
  const html = renderCityPage({ lang: "tr", city: { name: "Ankara", slug: "ankara" }, url: "/imsakiye/ankara/", rows: ramadanRows(), nearby: [], prayerUrl: "/namaz-vakitleri/ankara/", buildDate: "2026-11-22" });
  assert.match(html, /Kadir Gecesi: 5 Mart 2027 Cuma akşamı \(27\. gece\)/);
  assert.match(html, /<tr class="qadr"><td>26 · 5 Mar/);
});

test("altı dilde görünür SSS ile JSON-LD aynıdır, sorular yerel noktalama ve tarihler yereldir", () => {
  const cities = { tr: "Ankara", id: "Jakarta", ur: "اسلام آباد", bn: "ঢাকা", fa: "تهران", ar: "الرياض" };
  for (const [lang, name] of Object.entries(cities)) {
    const html = renderCityPage({ lang, city: { name, slug: "city" }, url: `/${lang}/city/`, rows: ramadanRows(), nearby: [], prayerUrl: "/prayer/", buildDate: "2026-11-22" });
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)].map((m) => JSON.parse(m[1]));
    const faq = blocks.find((x) => x["@type"] === "FAQPage");
    assert.equal(faq.mainEntity.length, 3, lang);
    for (const item of faq.mainEntity) {
      assert.equal(item.name.endsWith(["ar", "fa", "ur"].includes(lang) ? "؟" : "?"), true, `${lang}: ${item.name}`);
      const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
      assert.match(html, new RegExp(`<h3>${escapeHtml(item.name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</h3><p>${escapeHtml(item.acceptedAnswer.text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</p>`), lang);
      assert.doesNotMatch(item.acceptedAnswer.text, /February/i, lang);
    }
    assert.doesNotMatch(html, /\.\./, lang);
    const visible = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ");
    if (["ur", "bn", "fa", "ar"].includes(lang)) assert.doesNotMatch(visible, /\bRamadan\b/i, lang);
  }
});

test("Endonezya tablosu Imsak ve Subuh sütunlarını ayrı gösterir", () => {
  const html = renderCityPage({ lang: "id", city: { name: "Jakarta", slug: "jakarta" }, url: "/id/jadwal-imsakiyah/jakarta/", rows: ramadanRows(), nearby: [], prayerUrl: "/id/jadwal-sholat/jakarta/", buildDate: "2026-11-22" });
  assert.match(html, /<th>Tanggal<\/th><th>Imsak<\/th><th>Subuh<\/th><th>Terbit<\/th><th>Dzuhur<\/th><th>Ashar<\/th><th>Maghrib \(Buka puasa\)<\/th><th>Isya<\/th>/);
  assert.match(html, /<td>06:18<\/td><td>06:28<\/td>/);
});
