/** Yerel dilde dünya namaz vakti sayfalarını üretir. Ağ kullanmaz. */
const fs = require("fs");
const path = require("path");
const adhan = require("./js/adhan.min.js");
const { normalizeSearch } = require("./js/city-search");

const ROOT = __dirname;
const SITE = "https://hakyol.app";
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "world-cities.json"), "utf8"));
const DAYS = 30;
const APP_ID = "6794740149";
const PKG = "com.bahadir.hakyol";
const ROOTS = { id: "jadwal-sholat", bn: "namaz-er-somoy", ur: "namaz-ke-auqat", ar: "mawaqit-al-salat", fa: "owghat-sharei" };
const RTL = new Set(["ur", "ar", "fa"]);
const TEXT = {
  id: { title: "Jadwal Sholat", cityTitle: "Jadwal sholat {city}", pick: "Pilih kota Anda", search: "Cari kota", none: "Tidak ada hasil", all: "Semua kota", today: "Hari ini", month: "Jadwal 30 hari", next: "menuju {name}: {time}", date: "Tanggal", country: "Kota-kota di {country}", cta: "Unduh Hakyol gratis", desc: "Notifikasi azan saat waktu salat tiba, plus kiblat, Al-Qur'an, dan dzikir. Tanpa daftar, tanpa langganan.", as: "Unduh di App Store", gp: "Dapatkan di Google Play", method: "Dihitung dengan metode Kemenag RI (Subuh 20°, Isya 18°, ihtiyat 2 menit). Bisa berbeda 1–2 menit dari jadwal masjid setempat.", credit: "Data kota: GeoNames (CC BY 4.0)", privacy: "Kebijakan Privasi" },
  bn: { title: "নামাজের সময়", cityTitle: "{city} নামাজের সময়", pick: "আপনার শহর নির্বাচন করুন", search: "শহর খুঁজুন", none: "কোনো ফল পাওয়া যায়নি", all: "সব শহর", today: "আজ", month: "৩০ দিনের নামাজের সময়", next: "{name} পর্যন্ত {time}", date: "তারিখ", country: "{country}-এর শহর", cta: "বিনামূল্যে Hakyol ডাউনলোড করুন", desc: "নামাজের সময় হলে আজানের বিজ্ঞপ্তি, সাথে কিবলা, কুরআন ও জিকির। কোনো নিবন্ধন বা সাবস্ক্রিপশন নেই।", as: "App Store থেকে ডাউনলোড", gp: "Google Play থেকে ডাউনলোড", method: "করাচি পদ্ধতি ও হানাফি মাযহাব অনুযায়ী হিসাব করা হয়েছে। স্থানীয় মসজিদের সময়ের সঙ্গে ১–২ মিনিট পার্থক্য হতে পারে।", credit: "শহরের তথ্য: GeoNames (CC BY 4.0)", privacy: "গোপনীয়তা নীতি" },
  ur: { title: "نماز کے اوقات", cityTitle: "{city} نماز کے اوقات", pick: "اپنا شہر منتخب کریں", search: "شہر تلاش کریں", none: "کوئی نتیجہ نہیں", all: "تمام شہر", today: "آج", month: "30 دن کے نماز کے اوقات", next: "{name} تک {time}", date: "تاریخ", country: "{country} کے شہر", cta: "حاکیول مفت ڈاؤن لوڈ کریں", desc: "نماز کا وقت ہونے پر اذان کی اطلاع، ساتھ قبلہ، قرآن اور ذکر۔ نہ رجسٹریشن، نہ سبسکرپشن۔", as: "App Store سے ڈاؤن لوڈ کریں", gp: "Google Play سے حاصل کریں", method: "اوقات کراچی طریقے اور حنفی فقہ کے مطابق شمار کیے گئے ہیں۔ مقامی مسجد سے 1–2 منٹ فرق ہو سکتا ہے۔", credit: "شہر کا ڈیٹا: GeoNames (CC BY 4.0)", privacy: "رازداری کی پالیسی" },
  ar: { title: "مواقيت الصلاة", cityTitle: "مواقيت الصلاة في {city}", pick: "اختر مدينتك", search: "ابحث عن مدينة", none: "لا توجد نتائج", all: "كل المدن", today: "اليوم", month: "مواقيت الصلاة لـ30 يومًا", next: "متبقي على {name}: {time}", date: "التاريخ", country: "مدن {country}", cta: "حمّل حاكيول مجانًا", desc: "تنبيه بالأذان عند دخول وقت الصلاة، مع القبلة والقرآن والذكر. بلا تسجيل وبلا اشتراك.", as: "حمّله من App Store", gp: "احصل عليه من Google Play", credit: "بيانات المدن: GeoNames (CC BY 4.0)", privacy: "سياسة الخصوصية" },
  fa: { title: "اوقات شرعی", cityTitle: "اوقات شرعی {city}", pick: "شهر خود را انتخاب کنید", search: "جستجوی شهر", none: "نتیجه‌ای یافت نشد", all: "همه شهرها", today: "امروز", month: "اوقات شرعی ۳۰ روزه", next: "تا {name}: {time}", date: "تاریخ", country: "شهرهای {country}", cta: "حاکیول را رایگان دریافت کنید", desc: "اعلان اذان هنگام وقت نماز، همراه با قبله، قرآن و ذکر. بدون ثبت‌نام، بدون اشتراک.", as: "دریافت از App Store", gp: "دریافت از Google Play", credit: "داده‌های شهر: GeoNames (CC BY 4.0)", privacy: "سیاست حفظ حریم خصوصی" },
};
const PRAYERS = {
  id: [["imsak", "İmsak"], ["fajr", "Subuh"], ["sunrise", "Terbit"], ["dhuhr", "Dzuhur"], ["asr", "Ashar"], ["maghrib", "Maghrib"], ["isha", "Isya"]],
  bn: [["fajr", "ফজর"], ["sunrise", "সূর্যোদয়"], ["dhuhr", "যোহর"], ["asr", "আসর"], ["maghrib", "মাগরিব"], ["isha", "এশা"]],
  ur: [["fajr", "فجر"], ["sunrise", "طلوع آفتاب"], ["dhuhr", "ظہر"], ["asr", "عصر"], ["maghrib", "مغرب"], ["isha", "عشاء"]],
  ar: [["fajr", "الفجر"], ["sunrise", "الشروق"], ["dhuhr", "الظهر"], ["asr", "العصر"], ["maghrib", "المغرب"], ["isha", "العشاء"]],
  fa: [["fajr", "اذان صبح"], ["sunrise", "طلوع آفتاب"], ["dhuhr", "اذان ظهر"], ["asr", "عصر"], ["maghrib", "اذان مغرب"], ["isha", "عشا"]],
};
const DIGITS = { bn: "০১২৩৪৫৬৭৮৯", fa: "۰۱۲۳۴۵۶۷۸۹" };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const digits = (value, lang) => DIGITS[lang] ? String(value).replace(/\d/g, (n) => DIGITS[lang][n]) : String(value);
const iso = (date) => date.toISOString().slice(0, 10);
const addDays = (date, days) => new Date(date.getTime() + days * 86400000);
const localYmd = (date, tz) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
const formatTime = (date, tz) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);

function parameters(method) {
  let p;
  if (method === "kemenag") { p = adhan.CalculationMethod.Other(); p.fajrAngle = 20; p.ishaAngle = 18; p.adjustments = { fajr: 2, sunrise: -2, dhuhr: 2, asr: 2, maghrib: 2, isha: 2 }; }
  else if (method === "jordan") { p = adhan.CalculationMethod.Other(); p.fajrAngle = 18; p.ishaAngle = 18; p.adjustments.maghrib = 5; }
  else { const map = { "karachi-hanafi": "Karachi", "umm-al-qura": "UmmAlQura", dubai: "Dubai", qatar: "Qatar", kuwait: "Kuwait", egyptian: "Egyptian", tehran: "Tehran" }; p = adhan.CalculationMethod[map[method]](); }
  p.rounding = adhan.Rounding.Nearest;
  // AlAdhan'ın Dubai tanımı: doğuşta ek yok, ikindide +1 dk.
  if (method === "dubai") { p.methodAdjustments.sunrise = 0; p.methodAdjustments.asr = 1; }
  if (method === "karachi-hanafi") p.madhab = adhan.Madhab.Hanafi;
  return p;
}

function calculateTimes(country, city, ymd) {
  const date = new Date(`${ymd}T12:00:00Z`);
  const times = new adhan.PrayerTimes(new adhan.Coordinates(city.lat, city.lng), date, parameters(country.method));
  const result = {};
  for (const key of ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"]) result[key] = formatTime(times[key], city.tz);
  if (country.lang === "id") result.imsak = formatTime(new Date(times.fajr.getTime() - 10 * 60000), city.tz);
  return result;
}

function languageDate(ymd, lang) {
  const date = new Date(`${ymd}T12:00:00Z`);
  const locale = lang === "fa" ? "fa-IR-u-ca-persian" : `${lang}-u-ca-islamic-umalqura`;
  const greg = new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
  const local = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
  if (lang === "fa") {
    const hijri = new Intl.DateTimeFormat("fa-u-ca-islamic-umalqura", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
    return `${local} · ${hijri}`;
  }
  return `${greg} · ${local}`;
}

function methodText(country) {
  if (TEXT[country.lang].method) return TEXT[country.lang].method;
  const ar = { "umm-al-qura": "طريقة أم القرى", dubai: "طريقة دبي", qatar: "طريقة قطر", kuwait: "طريقة الكويت", egyptian: "الهيئة المصرية العامة للمساحة", jordan: "الفجر والعشاء 18° مع إضافة 5 دقائق للمغرب" };
  if (country.lang === "ar") return `حُسبت المواقيت وفق ${ar[country.method]}. قد تختلف دقيقة أو دقيقتين عن مسجدك المحلي.`;
  return country.method === "tehran" ? "محاسبه بر اساس روش تهران و فقه جعفری برای مغرب و عشا انجام شده است. ممکن است با مسجد محلی ۱ تا ۲ دقیقه تفاوت داشته باشد." : "محاسبه بر اساس روش کراچی و فقه حنفی انجام شده است. ممکن است با مسجد محلی ۱ تا ۲ دقیقه تفاوت داشته باشد.";
}

const CSS = `:root{--bg:#08101e;--card:#111c30;--border:#26344d;--text:#f5f3ec;--soft:#bdc5d3;--faint:#8290a8;--gold:#d4af37;--gold2:#f1d477;--goldsoft:rgba(212,175,55,.12);--sans:system-ui,-apple-system,"Segoe UI",sans-serif;--mono:ui-monospace,monospace}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.65 var(--sans)}a{color:var(--gold2);text-decoration:none}.wrap{width:min(1040px,calc(100% - 32px));margin:auto}.top{border-bottom:1px solid var(--border);padding:12px 0}.top .wrap{display:flex;justify-content:space-between;align-items:center}.brand{display:flex;align-items:center;gap:9px;color:var(--text);font-weight:800}.brand img{width:34px;border-radius:9px}.crumbs{font-size:13px;color:var(--faint);margin:22px 0}h1{font-size:clamp(28px,5vw,44px);line-height:1.2;margin:0 0 8px}.lead{color:var(--soft)}.search{margin:22px 0}.city-search{position:relative}.city-search input{width:100%;min-height:48px;border:1px solid var(--border);border-radius:12px;background:var(--card);color:var(--text);font:16px var(--sans);padding:11px 14px}.city-search-results{position:absolute;z-index:10;inset-inline:0;top:52px;background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden}.city-search-results:empty{display:none}.city-search-results a{display:block;padding:10px 14px}.city-search-results a:hover,.city-search-results a[aria-selected=true]{background:var(--goldsoft)}.city-search-results span{color:var(--faint)}.card,.cta{background:var(--card);border:1px solid var(--border);border-radius:18px;padding:20px;margin:22px 0}.grid{display:grid;grid-template-columns:repeat(6,1fr);gap:9px}.cell{background:var(--goldsoft);border-radius:12px;padding:10px 5px;text-align:center}.cell.next{outline:2px solid var(--gold)}.cell .n{display:block;color:var(--faint);font-size:12px}.cell .t{display:block;font:20px var(--mono)}.next-line{text-align:center;color:var(--gold2);min-height:1.6em}.cta{text-align:center}.btns{display:flex;justify-content:center;gap:10px;flex-wrap:wrap}.btns a,.all{display:inline-block;background:var(--gold);color:#241a04;font-weight:800;border-radius:12px;padding:10px 18px}.tbl{overflow-x:auto;border:1px solid var(--border);border-radius:14px}table{width:100%;border-collapse:collapse;min-width:650px}th,td{text-align:center;padding:8px;border-bottom:1px solid var(--border)}th{color:var(--faint);font-size:12px;background:var(--card)}td{font-family:var(--mono)}td:first-child{font-family:var(--sans);white-space:nowrap}tr.today{background:var(--goldsoft)}.method,.credit{color:var(--faint);font-size:13px}.cities{columns:3 180px;list-style:none;padding:0}.cities li{break-inside:avoid;padding:4px 0}footer{border-top:1px solid var(--border);margin-top:42px;padding:24px 0;color:var(--faint)}@media(max-width:650px){.wrap{width:min(100% - 20px,1040px)}.grid{grid-template-columns:repeat(3,1fr)}.card{padding:12px}.cell .t{font-size:18px}.cities{columns:2 130px}}`;

function breadcrumbLd(crumbs) { return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: crumbs.map(([name, url], i) => ({ "@type": "ListItem", position: i + 1, name, item: SITE + url })) }; }
function page({ lang, url, title, description, crumbs, body, tz }) {
  const t = TEXT[lang];
  return `<!doctype html><html lang="${lang}" dir="${RTL.has(lang) ? "rtl" : "ltr"}"${tz ? ` data-tz="${tz}"` : ""}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | Hakyol</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${SITE}${url}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${SITE}${url}"><meta property="og:image" content="${SITE}/og-image.png"><link rel="icon" href="/favicon-32.png"><link rel="stylesheet" href="/fonts/fonts.css"><style>${CSS}</style><script type="application/ld+json">${JSON.stringify(breadcrumbLd(crumbs))}</script></head><body><nav class="top"><div class="wrap"><a class="brand" href="/${lang}/"><img src="/icon.png" alt=""><span>Hakyol</span></a><a href="/${lang}/${ROOTS[lang]}/">${t.all}</a></div></nav><main class="wrap"><div class="crumbs">${crumbs.map(([n, u], i) => i === crumbs.length - 1 ? esc(n) : `<a href="${u}">${esc(n)}</a>`).join(" › ")}</div>${body}</main><footer><div class="wrap"><a href="/${lang}/">Hakyol</a> · <a href="/${lang}/${ROOTS[lang]}/">${t.title}</a> · <a href="/privacy-policy.html">${t.privacy}</a><p class="credit"><a href="https://www.geonames.org/" target="_blank" rel="noopener">${t.credit}</a></p><p>© 2026 3B Tech.</p></div></footer><script src="/js/city-search.js" defer></script><script src="/js/analytics.js" defer></script><script src="/js/app-popup.js" defer></script>${tz ? `<script>${clientJs(lang, tz)}</script>` : ""}</body></html>`;
}
function clientJs(lang, tz) {
  return `(function(){var names=${JSON.stringify(PRAYERS[lang].map((p) => p[1]))},tpl=${JSON.stringify(TEXT[lang].next)},tz=${JSON.stringify(tz)};function tick(){var parts=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).reduce(function(o,p){o[p.type]=p.value;return o},{}),ymd=parts.year+'-'+parts.month+'-'+parts.day,row=document.querySelector('tr[data-d="'+ymd+'"]');if(!row)return;document.querySelectorAll('tr[data-d]').forEach(function(r){r.classList.toggle('today',r===row)});var raw=row.getAttribute('data-times').split(','),now=+parts.hour*60 + +parts.minute,next=-1;document.querySelectorAll('.cell').forEach(function(c,i){c.querySelector('.t').textContent=row.children[i+1].textContent;var p=raw[i].split(':');if(next<0&&+p[0]*60 + +p[1]>now)next=i});document.querySelectorAll('.cell').forEach(function(c,i){c.classList.toggle('next',i===next)});var el=document.querySelector('.next-line');if(next<0){el.textContent='';return}var p=raw[next].split(':'),left=+p[0]*60 + +p[1]-now,h=Math.floor(left/60),m=left%60;el.textContent=tpl.replace('{name}',names[next]).replace('{time}',(h?h+':':'')+String(m).padStart(2,'0'))}tick();setInterval(tick,30000)})();`;
}
function cta(lang, campaign) { const t = TEXT[lang], app = `https://apps.apple.com/app/hakyol/id${APP_ID}?ct=${campaign}&mt=8`, play = `https://play.google.com/store/apps/details?id=${PKG}&referrer=utm_source%3Dhakyol.app%26utm_medium%3Dweb%26utm_campaign%3D${campaign}`; return `<div class="cta"><h2>${t.cta}</h2><p>${t.desc}</p><div class="btns"><a href="${app}" target="_blank" rel="noopener">${t.as}</a><a href="${play}" target="_blank" rel="noopener">${t.gp}</a></div></div>`; }
function search(lang) { const t = TEXT[lang]; return `<div class="search" data-city-search data-index="/${lang}/${ROOTS[lang]}/search.json" data-placeholder="${esc(t.search)}" data-no-results="${esc(t.none)}"></div>`; }
function cityPage(country, city, buildStart) {
  const start = city.tz ? new Date(`${localYmd(new Date(), city.tz)}T12:00:00Z`) : buildStart;
  const lang = country.lang, t = TEXT[lang], base = `/${lang}/${ROOTS[lang]}`, countryUrl = `${base}/${country.slug}/`, url = lang === "id" || lang === "bn" || lang === "ur" ? `${base}/${city.slug}/` : `${countryUrl}${city.slug}/`;
  const rows = Array.from({ length: DAYS }, (_, i) => { const ymd = iso(addDays(start, i)); return { ymd, times: calculateTimes(country, city, ymd) }; });
  const names = PRAYERS[lang], first = rows[0];
  const cells = names.map(([key, name]) => `<div class="cell"><span class="n">${name}</span><span class="t">${digits(first.times[key], lang)}</span></div>`).join("");
  const head = `<tr><th>${t.date}</th>${names.map((p) => `<th>${p[1]}</th>`).join("")}</tr>`;
  const body = rows.map((row) => `<tr data-d="${row.ymd}" data-times="${names.map((p) => row.times[p[0]]).join(",")}"><td>${digits(languageDate(row.ymd, lang), lang)}</td>${names.map((p) => `<td>${digits(row.times[p[0]], lang)}</td>`).join("")}</tr>`).join("");
  const title = t.cityTitle.replace("{city}", city.name), crumbs = [["Hakyol", `/${lang}/`], [t.title, `${base}/`]];
  if (lang === "ar" || lang === "fa") crumbs.push([country.names[lang], countryUrl]);
  crumbs.push([city.name, url]);
  const SEO = { id: ["Jadwal Sholat {city} Hari Ini, {date}", "Jadwal sholat {city} hari ini: {times}. Jadwal 30 hari dan notifikasi azan.", ", "], ar: ["مواقيت الصلاة في {city} اليوم، {date}", "مواقيت الصلاة في {city} اليوم: {times}. مواقيت 30 يومًا وتنبيه الأذان.", "، "], fa: ["اوقات شرعی {city} امروز، {date}", "اوقات شرعی {city} امروز: {times}. اوقات ۳۰ روزه و اعلان اذان.", "، "], ur: ["{city} نماز کے اوقات آج، {date}", "{city} میں آج نماز کے اوقات: {times}۔ 30 دن کے اوقات اور اذان کی اطلاع۔", "، "], bn: ["{city} আজকের নামাজের সময়, {date}", "{city} আজকের নামাজের সময়: {times}। ৩০ দিনের সময়সূচি ও আজানের নোটিফিকেশন।", ", "] }[lang];
  const dateText = digits(languageDate(first.ymd, lang).split(" · ")[0], lang), timesText = names.filter(([k]) => k !== "imsak" && k !== "sunrise").map(([k, n]) => `${n} ${digits(first.times[k], lang)}`).join(SEO[2]);
  const seoTitle = SEO[0].replace("{city}", city.name).replace("{date}", dateText), seoDesc = SEO[1].replace("{city}", city.name).replace("{times}", timesText);
  return { url, html: page({ lang, url, title: seoTitle, description: seoDesc, crumbs, tz: city.tz, body: `<h1>${esc(title)}</h1><p class="lead">${digits(languageDate(first.ymd, lang), lang)}</p>${search(lang)}<div class="card"><div class="grid">${cells}</div><p class="next-line"></p></div>${cta(lang, `city_${country.cc.toLowerCase()}_${city.slug}`)}<h2>${t.month}</h2><div class="tbl"><table>${head}${body}</table></div><p class="method">${methodText(country)}</p>` }) };
}
function writeUrl(url, html) { const dest = path.join(ROOT, url, "index.html"); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, html); }
function build() {
  const start = new Date(`${localYmd(new Date(), "UTC")}T12:00:00Z`), urls = [], byLang = Object.groupBy(DATA.countries, (c) => c.lang);
  for (const [lang, countries] of Object.entries(byLang)) {
    const base = `/${lang}/${ROOTS[lang]}`, t = TEXT[lang], searchRows = [];
    for (const country of countries) for (const city of country.cities) { const built = cityPage(country, city, start); writeUrl(built.url, built.html); urls.push(built.url); searchRows.push([city.name, country.names[lang], built.url, normalizeSearch(`${city.name} ${city.asciiName} ${country.names[lang]}`)]); }
    fs.mkdirSync(path.join(ROOT, base), { recursive: true }); fs.writeFileSync(path.join(ROOT, base, "search.json"), JSON.stringify(searchRows));
    if (countries.length > 1) for (const country of countries) { const url = `${base}/${country.slug}/`, crumbs = [["Hakyol", `/${lang}/`], [t.title, `${base}/`], [country.names[lang], url]]; writeUrl(url, page({ lang, url, title: `${t.title} — ${country.names[lang]}`, description: t.pick, crumbs, body: `<h1>${country.names[lang]}</h1><p class="lead">${t.pick}</p>${search(lang)}<ul class="cities">${country.cities.map((c) => `<li><a href="${url}${c.slug}/">${esc(c.name)}</a></li>`).join("")}</ul>` })); urls.push(url); }
    const hubUrl = `${base}/`, crumbs = [["Hakyol", `/${lang}/`], [t.title, hubUrl]], sections = countries.map((country) => `<h2>${country.names[lang]}</h2><ul class="cities">${country.cities.map((city) => { const href = countries.length > 1 ? `${base}/${country.slug}/${city.slug}/` : `${base}/${city.slug}/`; return `<li><a href="${href}">${esc(city.name)}</a></li>`; }).join("")}</ul>`).join("");
    writeUrl(hubUrl, page({ lang, url: hubUrl, title: t.title, description: t.pick, crumbs, body: `<h1>${t.title}</h1><p class="lead">${t.pick}</p>${search(lang)}${sections}${cta(lang, `city_${lang}_hub`)}` })); urls.push(hubUrl);
  }
  const today = iso(start), xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq></url>`).join("\n")}\n</urlset>\n`; fs.writeFileSync(path.join(ROOT, "sitemap-world.xml"), xml);
  console.log(`world: ${urls.length} sayfa, sitemap-world.xml`);
}

if (require.main === module) build();
module.exports = { parameters, calculateTimes, digits, languageDate, ROOTS, TEXT, PRAYERS };
