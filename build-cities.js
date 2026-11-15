/**
 * hakyol.app şehir sayfaları — her il ve ilçe için statik "namaz vakitleri" sayfası.
 *
 *   node build-cities.js
 *
 * Girdi:  data/diyanet-tr.json (il/ilçe listesi), data/vakitler.json (scripts/fetch-vakitler.js)
 * Çıktı:  /namaz-vakitleri/index.html, /namaz-vakitleri/<il>/index.html,
 *         /namaz-vakitleri/<il>/<ilce>/index.html, /sitemap-namaz.xml
 *
 * Çıktılar commit edilmez (.gitignore); GitHub Actions her gün yeniden üretip
 * yayınlar (.github/workflows/pages.yml). Sayfadaki "bugün" kutusu üretim gününe
 * göre yazılır, tarayıcıda aylık tablodan o günün satırıyla güncellenir.
 */
const fs = require("fs");
const path = require("path");
const { normalizeSearch } = require("./js/city-search");

const ROOT = __dirname;
const SITE = "https://hakyol.app";
const BASE_PATH = "/namaz-vakitleri";
const OUT_DIR = path.join(ROOT, "namaz-vakitleri");
const APP_ID = "6794740149";
const PKG = "com.bahadir.hakyol";
const DAYS_SHOWN = 30;

const LIST = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "diyanet-tr.json"), "utf8"));
const WORLD = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "diyanet-dunya.json"), "utf8"));
// Resmî 973 ilçe (tr.wikipedia "Türkiye'nin ilçeleri", İçişleri envanteri): doğru yazım + Diyanet'in
// ayrı vakit vermediği ilçeler. Bunlar il merkezi vaktiyle yayınlanır (Diyanet'in kendi uygulaması).
const OFFICIAL = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "ilceler-resmi.json"), "utf8"));
const VAKIT = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "vakitler.json"), "utf8")).ilce;
const TURKEY_MAP = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "turkiye-iller.svg.json"), "utf8"));

// Diyanet listesinde Türkçe karakteri düşmüş adlar.
const NAME_FIX = {
  ARNAVUTKOY: "Arnavutköy",
  DEMIRKOY: "Demirköy",
  PEHLIVANKOY: "Pehlivanköy",
  BALISEYH: "Balışeyh",
  CELEBI: "Çelebi",
  DELICE: "Delice",
  KARAKECILI: "Karakeçili",
  CICEKDAGI: "Çiçekdağı",
  VIZE: "Vize",
  PINARHISAR: "Pınarhisar",
  // Resmî adı farklı yazılanlar
  DOĞUBEYAZIT: "Doğubayazıt",
  "BÜYÜK ORHAN": "Büyükorhan",
  "MUSTAFA KEMALPAŞA": "Mustafakemalpaşa",
  "ŞARKİ KARAAĞAÇ": "Şarkikaraağaç",
  "YENİSAR BADEMLİ": "Yenişarbademli",
  "M.EREĞLİSİ": "Marmaraereğlisi",
};

const NAMES = ["İmsak", "Güneş", "Öğle", "İkindi", "Akşam", "Yatsı"];
const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const WEEKDAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const WEEKDAYS_SHORT = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

// "AKSU (I)" / "ALTINYAYLA(S)" -> "AKSU": parantez Diyanet'in aynı adlı ilçeleri ayırma eki.
const stripSuffix = (s) => s.replace(/\s*\([^)]*\)\s*$/, "").trim();

function displayName(raw) {
  const s = stripSuffix(raw);
  if (NAME_FIX[s]) return NAME_FIX[s];
  return s
    .toLocaleLowerCase("tr-TR")
    .replace(/(^|[\s-])(\S)/g, (m, sep, ch) => sep + ch.toLocaleUpperCase("tr-TR"));
}

function slugify(name) {
  const map = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };
  return name
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşüâîû]/g, (c) => map[c])
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Bulunma hâli eki: Ankara'da, Bitlis'te, Tokat'ta (son ünlü + sert ünsüz). İyelik ekiyle
// biten birleşik adlar "n" alır: Gölbaşı'nda, Kuşadası'nda, Kocaeli'nde, Beypazarı'nda.
const COMPOUND_END = /(başı|dağı|dası|pazarı|hanı|madeni|eli|deresi|kapısı|suyu|yolu|ağzı|köprüsü|kalesi|hisarı|ovası|gölü)$/;

function loc(name) {
  const lower = name.toLocaleLowerCase("tr-TR");
  const vowels = lower.match(/[aıoueiöü]/g) || ["a"];
  const back = "aıou".includes(vowels[vowels.length - 1]);
  if (COMPOUND_END.test(lower)) return `${name}'n${back ? "da" : "de"}`;
  const hard = "fstkçşhp".includes(lower[lower.length - 1]);
  return `${name}'${hard ? "t" : "d"}${back ? "a" : "e"}`;
}

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Türkiye tek saat dilimi (UTC+3, yaz saati yok).
function todayTR() {
  return new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10);
}

function longDate(isoDate) {
  const d = new Date(isoDate + "T12:00:00Z");
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} ${WEEKDAYS[d.getUTCDay()]}`;
}

function shortDate(isoDate) {
  const d = new Date(isoDate + "T12:00:00Z");
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)} ${WEEKDAYS_SHORT[d.getUTCDay()]}`;
}

// --- model ---------------------------------------------------------------

const today = todayTR();
const thisMonth = MONTHS[Number(today.slice(5, 7)) - 1] + " " + today.slice(0, 4);

const officialByIl = {};
for (const r of OFFICIAL) (officialByIl[slugify(r.il)] ||= { name: r.il, ilceler: [] }).ilceler.push(r.ilce);

const iller = LIST.map((il) => {
  const official = officialByIl[slugify(displayName(il.sehir))];
  const name = official ? official.name : displayName(il.sehir);
  const slug = slugify(name);
  // Resmî yazım (Kâğıthane, Eyüpsultan) Diyanet'in büyük harfli adından üstün.
  const proper = (n) => (official && official.ilceler.find((o) => slugify(o) === slugify(n))) || n;
  // Diyanet il merkezini il adıyla aynı adlı ilçe olarak verir (ör. İSTANBUL, YALOVA).
  const center = il.ilceler.find((x) => x.ilce === il.sehir) || il.ilceler[0];
  const ilceler = il.ilceler
    .filter((x) => x !== center)
    .map((x) => {
      const n = proper(displayName(x.ilce));
      return { id: x.ilceId, name: n, slug: slugify(n) };
    });
  const known = new Set([slug, ...ilceler.map((x) => x.slug)]);
  const viaCenter = official
    ? official.ilceler.filter((n) => !known.has(slugify(n))).map((n) => ({ name: n, slug: slugify(n), viaCenter: true }))
    : [];
  return { name, slug, centerId: center.ilceId, ilceler, viaCenter };
}).sort((a, b) => a.name.localeCompare(b.name, "tr"));

const ilSlugs = new Set(iller.map((il) => il.slug));
for (const country of WORLD.countries) {
  if (ilSlugs.has(country.slug)) throw new Error(`Ülke slug'ı il slug'ıyla çakışıyor: ${country.slug}`);
}

const countries = WORLD.countries.map((country) => ({
  ...country,
  cities: country.cities.map((city) => ({ ...city, rows: rowsFor(city.ilceId) })),
}));

// Instagram gönderileri aynı il/ilçe eşleştirmesini kullanır (instagram/places.py); nüfus etiket sırası için.
const nufus = Object.fromEntries(OFFICIAL.map((r) => [slugify(r.il) + "/" + slugify(r.ilce), r.nufus]));
fs.writeFileSync(
  path.join(ROOT, "instagram", "places.json"),
  JSON.stringify(
    iller.map((il) => ({
      name: il.name,
      slug: il.slug,
      centerId: il.centerId,
      ilceler: [...il.ilceler, ...il.viaCenter].map((x) => ({
        name: x.name,
        slug: x.slug,
        id: x.id || il.centerId,
        viaCenter: !!x.viaCenter,
        nufus: nufus[il.slug + "/" + x.slug] || 0,
      })),
    })),
  ),
);

function rowsFor(id) {
  const rows = (VAKIT[id] || []).filter((r) => r[0] >= today).slice(0, DAYS_SHOWN);
  return rows.length && rows[0][0] === today ? rows : null;
}

// Bugünün verisi olmayan yer o gün yayınlanmaz (bağlantılardan da düşer); çoğu eksikse üretim durur.
const ilceCount = iller.reduce((n, il) => n + il.ilceler.length + 1, 0);
const missing = [];
for (const il of iller) {
  il.rows = rowsFor(il.centerId);
  if (!il.rows) missing.push(il.name);
  il.ilceler = il.ilceler.filter((x) => (x.rows = rowsFor(x.id)) || !missing.push(`${x.name}, ${il.name}`));
  if (il.rows) il.ilceler.push(...il.viaCenter.map((x) => ({ ...x, rows: il.rows })));
  il.ilceler.sort((a, b) => a.name.localeCompare(b.name, "tr"));
}
if (missing.length) console.warn(`${today} için vakit yok, atlandı (${missing.length}): ${missing.join("; ")}`);
if (missing.length > ilceCount * 0.1) {
  console.error("Eksik çok fazla — önce scripts/fetch-vakitler.js çalıştır");
  process.exit(1);
}

// --- HTML parçaları -------------------------------------------------------

const CSS = `
:root{--bg:#0B1220;--card:#141E32;--card-border:rgba(212,175,55,.22);--gold:#D4AF37;--gold-soft:rgba(212,175,55,.12);
--gold-text:#F2D58C;--text:#F5F3EC;--text-soft:#C9CEDA;--text-faint:#7C8AA3;
--serif:'Playfair Display',Georgia,serif;--sans:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
--mono:'IBM Plex Mono',ui-monospace,monospace}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font-family:var(--sans);line-height:1.6;overflow-x:hidden}
a{color:var(--gold-text);text-decoration:none}a:hover{text-decoration:underline}
.wrap{max-width:860px;margin:0 auto;padding:0 16px}
nav.top{border-bottom:1px solid var(--card-border);padding:14px 0}
nav.top .wrap{display:flex;align-items:center;justify-content:space-between;gap:12px}
.brand{display:flex;align-items:center;gap:10px;color:var(--text);font-weight:700}
.brand img{width:32px;height:32px;border-radius:8px}
.crumbs{font-size:13px;color:var(--text-faint);margin:22px 0 6px}
.crumbs a{color:var(--text-soft)}
h1{font-family:var(--serif);font-weight:600;font-size:clamp(26px,5vw,38px);line-height:1.2;margin:0 0 6px}
.date{color:var(--text-soft);margin:0 0 20px}
.note{margin:-12px 0 18px;font-size:13px;color:var(--text-faint)}
.card{background:var(--card);border:1px solid var(--card-border);border-radius:18px;padding:20px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.cell{background:var(--gold-soft);border-radius:12px;padding:12px 6px;text-align:center}
.cell.next{outline:2px solid var(--gold)}
.cell .n{display:block;font-size:12px;color:var(--text-faint);letter-spacing:.3px}
.cell .t{display:block;font-family:var(--mono);font-size:22px;margin-top:2px}
.next-line{margin:14px 0 0;text-align:center;color:var(--gold-text);font-weight:600;min-height:1.6em}
.meta{display:flex;flex-wrap:wrap;gap:8px 20px;justify-content:center;margin-top:10px;font-size:13px;color:var(--text-soft)}
.cta{margin:24px 0;background:linear-gradient(135deg,rgba(212,175,55,.18),rgba(212,175,55,.06));border:1px solid var(--gold);border-radius:18px;padding:20px;text-align:center}
.cta h2{font-family:var(--serif);font-size:22px;margin:0 0 6px}
.cta p{margin:0 0 14px;color:var(--text-soft)}
.cta .free{display:inline-block;font-size:12px;font-weight:700;letter-spacing:.4px;color:#241a04;background:var(--gold);border-radius:999px;padding:4px 12px;margin-bottom:10px}
.btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.btns a{display:inline-block;border:1px solid var(--gold);border-radius:12px;padding:10px 18px;color:var(--text);font-weight:700}
.btns a:hover{background:var(--gold-soft);text-decoration:none}
h2.sec{font-family:var(--serif);font-weight:600;font-size:22px;margin:32px 0 12px}
.tbl-wrap{overflow-x:auto;border:1px solid var(--card-border);border-radius:14px}
table{width:100%;border-collapse:collapse;font-size:14px;min-width:520px}
th,td{padding:8px 10px;text-align:center;border-bottom:1px solid rgba(212,175,55,.1)}
th{color:var(--text-faint);font-weight:600;font-size:12px;background:var(--card)}
td:first-child,th:first-child{text-align:left;white-space:nowrap}
td{font-family:var(--mono)}td:first-child{font-family:var(--sans)}
tr.today td{background:var(--gold-soft);color:var(--gold-text)}
.prose{color:var(--text-soft)}
.links{columns:3 160px;column-gap:20px;padding:0;margin:0;list-style:none}
.links li{padding:3px 0;break-inside:avoid}
.faq h3{font-size:16px;margin:16px 0 4px}.faq p{margin:0;color:var(--text-soft)}
footer{margin-top:40px;border-top:1px solid var(--card-border);padding:20px 0 32px;font-size:13px;color:var(--text-faint)}
footer a{color:var(--text-soft);margin-right:14px}
.disc{font-size:12px;color:var(--text-faint);margin-top:10px}
.ig{margin:28px 0 0;padding:14px 16px;border:1px solid var(--card-border);border-radius:12px;font-size:15px;color:var(--text-soft);text-align:center}
.ig a{font-weight:700}
.city-search{position:relative;margin:0 0 22px}.city-search input{width:100%;min-height:48px;border:1px solid var(--card-border);border-radius:12px;background:var(--card);color:var(--text);font:16px var(--sans);padding:11px 14px;outline:none}.city-search input:focus{border-color:var(--gold);box-shadow:0 0 0 3px var(--gold-soft)}
.city-search-results{position:absolute;z-index:20;inset-inline:0;top:calc(100% + 4px);background:var(--card);border:1px solid var(--card-border);border-radius:12px;box-shadow:0 12px 30px rgba(0,0,0,.35);overflow:hidden}.city-search-results:empty{display:none}.city-search-results a{display:block;padding:10px 14px;color:var(--text);text-decoration:none}.city-search-results a[aria-selected="true"],.city-search-results a:hover{background:var(--gold-soft)}.city-search-results span{color:var(--text-faint)}
@media(max-width:480px){.grid{grid-template-columns:repeat(2,1fr)}.cell .t{font-size:20px}
table{min-width:0;font-size:12px}th,td{padding:7px 3px}th{font-size:10.5px}td:first-child,th:first-child{padding-left:8px}}
`;

// Tarayıcıda: aylık tablodan bugünün satırını bulup kutuyu günceller, sıradaki vakti ve kalan süreyi gösterir.
const CLIENT_JS = `
(function(){
  var rows=document.querySelectorAll('tr[data-d]');if(!rows.length)return;
  function trNow(){if(document.documentElement.hasAttribute('data-local-clock')){var d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000);}return new Date(Date.now()+3*3600000);}
  function tick(){
    var now=trNow(),d=now.toISOString().slice(0,10),row=null;
    rows.forEach(function(r){r.classList.toggle('today',r.getAttribute('data-d')===d);if(r.getAttribute('data-d')===d)row=r;});
    if(!row)return;
    var ts=[].map.call(row.querySelectorAll('td'),function(td){return td.textContent;}).slice(1,7);
    var cells=document.querySelectorAll('.cell');
    var dl=document.querySelector('.date [data-long]');if(dl&&row.getAttribute('data-long'))dl.textContent=row.getAttribute('data-long');
    var mins=now.getUTCHours()*60+now.getUTCMinutes(),next=-1;
    ts.forEach(function(t,i){var p=t.split(':');cells[i].querySelector('.t').textContent=t;
      if(next<0&&(+p[0])*60+(+p[1])>mins)next=i;});
    cells.forEach(function(c,i){c.classList.toggle('next',i===next);});
    var el=document.querySelector('.next-line');if(!el)return;
    if(next<0){el.textContent='';return;}
    var p=ts[next].split(':'),left=(+p[0])*60+(+p[1])-mins,h=Math.floor(left/60),m=left%60;
    el.textContent=cells[next].querySelector('.n').textContent+' vaktine '+(h?h+' saat ':'')+m+' dakika kaldı';
  }
  tick();setInterval(tick,30000);
})();
`;

function storeLinks(campaign) {
  return {
    appStore: `https://apps.apple.com/app/hakyol/id${APP_ID}?ct=${campaign}&mt=8`,
    play: `https://play.google.com/store/apps/details?id=${PKG}&referrer=utm_source%3Dhakyol.app%26utm_medium%3Dweb%26utm_campaign%3D${campaign}`,
  };
}

function cta(place, campaign) {
  const s = storeLinks(campaign);
  return `<div class="cta">
<span class="free">ÜCRETSİZ · ÜYELİK YOK · ABONELİK YOK</span>
<h2>${esc(place)} için ezan vaktini kaçırmayın</h2>
<p>Hakyol vakit girince ezan sesiyle haber verir. Kıble pusulası, Kur'an-ı Kerim, zikirmatik ve Kâbe canlı yayını da içinde.</p>
<div class="btns"><a href="${esc(s.appStore)}" target="_blank" rel="noopener">App Store'dan indir</a><a href="${esc(s.play)}" target="_blank" rel="noopener">Google Play'den indir</a></div>
</div>`;
}

function todayBox(r) {
  const cells = NAMES.map((n, i) => `<div class="cell"><span class="n">${n}</span><span class="t">${r[i + 1]}</span></div>`).join("");
  return `<div class="card"><div class="grid">${cells}</div>
<p class="next-line"></p>
<div class="meta"><span>Hicri: ${esc(r[8])}</span><span>Kıble saati: ${r[7]}</span></div></div>`;
}

function monthTable(rows) {
  const head = `<tr><th>Tarih</th>${NAMES.map((n) => `<th>${n}</th>`).join("")}</tr>`;
  const body = rows
    .map(
      (r) =>
        `<tr data-d="${r[0]}" data-long="${esc(longDate(r[0]))}"${r[0] === today ? ' class="today"' : ""}><td>${shortDate(r[0])}</td>${r
          .slice(1, 7)
          .map((t) => `<td>${t}</td>`)
          .join("")}</tr>`
    )
    .join("");
  return `<div class="tbl-wrap"><table>${head}${body}</table></div>`;
}

function faq(place, r, foreign) {
  const where = foreign ? `${place} için` : loc(place);
  const qa = [
    [`${where} bugün akşam ezanı saat kaçta?`, `${longDate(r[0])} günü ${place} için akşam ezanı saati: ${r[5]}. Ramazan'da iftar vakti de bu saattir.`],
    [`${where} imsak (sahur) vakti saat kaçta?`, `Bugün ${place} için imsak vakti: ${r[1]}. Sabah namazı imsak ile güneşin doğuşu (${r[2]}) arasında kılınır.`],
    [`${where} cuma namazı saat kaçta?`, `Cuma namazı öğle vaktinde kılınır. Bugün ${place} için öğle vakti: ${r[3]}. Cuma gününün saatini yukarıdaki aylık tablodan görebilirsiniz.`],
    [`${place} için kıble saati nedir?`, `Kıble saati, güneşin tam kıble yönünde bulunduğu andır. Bugün ${place} için kıble saati: ${r[7]}. Bu saatte güneşe dönen kişi kıbleye dönmüş olur.`],
  ];
  const html = `<div class="faq">${qa.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join("")}</div>`;
  const ld = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: qa.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };
  return { html, ld };
}

function breadcrumbLd(trail) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map(([name, url], i) => ({ "@type": "ListItem", position: i + 1, name, item: SITE + url })),
  };
}

function page({ url, title, description, crumbs, body, ld, localClock, turkeyMap }) {
  const crumbHtml = crumbs
    .map(([name, href], i) => (i === crumbs.length - 1 ? esc(name) : `<a href="${href}">${esc(name)}</a>`))
    .join(" › ");
  return `<!doctype html>
<html lang="tr" dir="ltr"${localClock ? " data-local-clock" : ""}>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${SITE}${url}" />
<meta name="apple-itunes-app" content="app-id=${APP_ID}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${SITE}${url}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:image" content="${SITE}/og-image.png" />
<meta property="og:locale" content="tr_TR" />
<meta property="og:site_name" content="Hakyol" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
<link rel="stylesheet" href="/fonts/fonts.css" />
${turkeyMap ? '<link rel="stylesheet" href="/css/turkey-map.css" />' : ""}
<style>${CSS}</style>
${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n")}
</head>
<body>
<nav class="top"><div class="wrap"><a class="brand" href="/"><img src="/icon.png" alt="Hakyol" /><span>Hakyol</span></a><a href="${BASE_PATH}/">Tüm iller</a></div></nav>
<main class="wrap">
<div class="crumbs">${crumbHtml}</div>
${body}
<p class="ig">Günlük ayet ve hadisler için Instagram'da takip edin: <a href="https://www.instagram.com/hakyol.app/" rel="noopener">@hakyol.app</a></p>
</main>
<footer><div class="wrap">
<a href="/">Hakyol</a><a href="${BASE_PATH}/">Namaz vakitleri</a><a href="/privacy-policy.html">Gizlilik Politikası</a><a href="/kvkk-aydinlatma-metni.html">KVKK</a><a href="https://www.instagram.com/hakyol.app/" rel="noopener">Instagram</a>
<p class="disc">Vakitler Diyanet İşleri Başkanlığı verisine dayanır. Resmî kaynak namazvakti.diyanet.gov.tr'dir. © 2026 3B Tech.</p>
</div></footer>
<script>${CLIENT_JS}</script>
<script src="/js/city-search.js" defer></script>
${turkeyMap ? '<script src="/js/turkey-map.js" defer></script>' : ""}
<script src="/js/analytics.js" defer></script>
<script src="/js/app-popup.js" defer></script>
</body>
</html>
`;
}

function placePage({ place, fullPlace, url, crumbs, rows, campaign, extra, note, country }) {
  const r = rows[0];
  const f = faq(place, r, !!country);
  const title = country ? `${place} Namaz Vakitleri — ${country} | Hakyol` : `${fullPlace} Namaz Vakitleri — Ezan Saatleri ${thisMonth} | Hakyol`;
  const description = country
    ? `${place} (${country}) için Diyanet İşleri Başkanlığı verisiyle güncel imsak, güneş, öğle, ikindi, akşam ve yatsı vakitleri.`
    : `${fullPlace} namaz vakitleri: bugün imsak ${r[1]}, öğle ${r[3]}, ikindi ${r[4]}, akşam ${r[5]}, yatsı ${r[6]}. Diyanet verisiyle ${DAYS_SHOWN} günlük ezan saatleri ve kıble saati.`;
  const body = `
<h1>${esc(fullPlace)} Namaz Vakitleri</h1>
<p class="date"><span data-long>${esc(longDate(r[0]))}</span></p>
<div data-city-search data-index="${BASE_PATH}/arama.json" data-placeholder="İl, ilçe veya şehir ara" data-no-results="Sonuç yok"></div>
${note ? `<p class="note">${esc(note)}</p>` : ""}
${todayBox(r)}
${cta(place, campaign)}
<h2 class="sec">${esc(place)} ${DAYS_SHOWN} günlük namaz vakitleri</h2>
${monthTable(rows)}
<p class="prose">${esc(place)} için ezan saatleri Diyanet İşleri Başkanlığı'nın yayımladığı vakitlerdir. ${country ? `${esc(place)} için` : esc(loc(place))} bugün ezan saatleri şöyle: imsak ${r[1]}, güneş ${r[2]}, öğle ${r[3]}, ikindi ${r[4]}, akşam ${r[5]}, yatsı ${r[6]}. Tablodaki öbür günlerin vakitleri de Diyanet takvimiyle aynıdır.</p>
${extra || ""}
<h2 class="sec">Sık sorulanlar</h2>
${f.html}`;
  return page({
    url,
    title,
    description,
    crumbs,
    body,
    ld: [breadcrumbLd(crumbs.map(([n, h]) => [n, h])), f.ld],
    localClock: !!country,
  });
}

// --- üretim ---------------------------------------------------------------

function write(rel, html) {
  const dest = path.join(OUT_DIR, rel, "index.html");
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, html);
}

fs.rmSync(OUT_DIR, { recursive: true, force: true });
const urls = [`${BASE_PATH}/`];
const rootCrumb = ["Namaz Vakitleri", `${BASE_PATH}/`];

const liveIller = iller.filter((il) => il.rows);
const ilBySlug = new Map(liveIller.map((il) => [il.slug, il]));
if (TURKEY_MAP.paths.length !== 81 || TURKEY_MAP.paths.some((item) => !ilBySlug.has(item.slug))) {
  throw new Error("Türkiye haritasındaki 81 ilin tamamı yayınlanan il listesiyle eşleşmeli");
}
const turkeyMapHtml = `<div class="turkey-map" data-turkey-map>
<svg role="img" aria-label="Türkiye il haritası" viewBox="${esc(TURKEY_MAP.viewBox)}" preserveAspectRatio="xMidYMid meet">
${TURKEY_MAP.paths.map((item) => `<a href="${BASE_PATH}/${item.slug}/" aria-label="${esc(item.name)} namaz vakitleri" data-map-name="${esc(item.name)}"><path d="${item.d}"><title>${esc(item.name)}</title></path></a>`).join("\n")}
</svg>
<p class="turkey-map-label" data-map-label aria-live="polite"></p>
<p class="turkey-map-note">Haritada bulamadınız mı? Yukarıdan arayın ya da listeden seçin.</p>
</div>`;
for (const il of iller) {
  const ilUrl = `${BASE_PATH}/${il.slug}/`;
  const ilceList = il.ilceler.length
    ? `<h2 class="sec">${esc(il.name)} ilçeleri namaz vakitleri</h2><ul class="links">${il.ilceler
        .map((x) => `<li><a href="${ilUrl}${x.slug}/">${esc(x.name)}</a></li>`)
        .join("")}</ul>`
    : "";
  if (il.rows) write(
    il.slug,
    placePage({
      place: il.name,
      fullPlace: il.name,
      url: ilUrl,
      crumbs: [["Hakyol", "/"], rootCrumb, [il.name, ilUrl]],
      rows: il.rows,
      campaign: `city_${il.slug}`,
      extra: ilceList,
    })
  );
  if (il.rows) urls.push(ilUrl);

  for (const x of il.ilceler) {
    const url = `${ilUrl}${x.slug}/`;
    const siblings = il.ilceler
      .filter((y) => y !== x)
      .map((y) => `<li><a href="${ilUrl}${y.slug}/">${esc(y.name)}</a></li>`)
      .join("");
    const center = il.rows ? `<li><a href="${ilUrl}">${esc(il.name)} merkez</a></li>` : "";
    const extra = `<h2 class="sec">${esc(il.name)} ve diğer ilçeler</h2><ul class="links">${center}${siblings}</ul>`;
    write(
      `${il.slug}/${x.slug}`,
      placePage({
        place: x.name,
        fullPlace: `${x.name}, ${il.name}`,
        url,
        crumbs: [["Hakyol", "/"], rootCrumb, [il.name, ilUrl], [x.name, url]],
        rows: x.rows,
        campaign: `city_${il.slug}_${x.slug}`,
        extra,
        note: x.viaCenter ? `Diyanet ${x.name} için ayrı vakit yayımlamaz; ${il.name} merkezi vakitleri geçerlidir.` : null,
      })
    );
    urls.push(url);
  }
}

for (const country of countries) {
  const countryUrl = `${BASE_PATH}/${country.slug}/`;
  const liveCities = country.cities.filter((city) => city.rows);
  write(
    country.slug,
    page({
      url: countryUrl,
      title: `${country.name} Namaz Vakitleri — Şehirler | Hakyol`,
      description: `${country.name} şehirleri için Diyanet verisiyle güncel namaz vakitleri ve ezan saatleri.`,
      crumbs: [["Hakyol", "/"], rootCrumb, [country.name, countryUrl]],
      body: `<h1>${esc(country.name)} Namaz Vakitleri</h1><p class="date">Şehrinizi seçin.</p>
<div data-city-search data-index="${BASE_PATH}/arama.json" data-placeholder="İl, ilçe veya şehir ara" data-no-results="Sonuç yok"></div>
<ul class="links">${liveCities.map((city) => `<li><a href="${countryUrl}${city.slug}/">${esc(city.name)}</a></li>`).join("")}</ul>`,
      ld: [breadcrumbLd([["Hakyol", "/"], rootCrumb, [country.name, countryUrl]])],
    })
  );
  urls.push(countryUrl);
  for (const city of liveCities) {
    const url = `${countryUrl}${city.slug}/`;
    const others = liveCities.filter((other) => other !== city).map((other) => `<li><a href="${countryUrl}${other.slug}/">${esc(other.name)}</a></li>`).join("");
    write(`${country.slug}/${city.slug}`, placePage({
      place: city.name, fullPlace: `${city.name}, ${country.name}`, country: country.name, url,
      crumbs: [rootCrumb, [country.name, countryUrl], [city.name, url]], rows: city.rows,
      campaign: `city_${country.slug}_${city.slug}`,
      note: `Saatler ${city.name} yerel saatine göredir.`,
      extra: `<h2 class="sec">${esc(country.name)} ve diğer şehirler</h2><ul class="links">${others}</ul>`,
    }));
    urls.push(url);
  }
}

// Hub: 81 il
write(
  "",
  page({
    url: `${BASE_PATH}/`,
    title: `Namaz Vakitleri — 81 İl ve İlçe Ezan Saatleri ${thisMonth} | Hakyol`,
    description: "Türkiye'nin 81 ili ve tüm ilçeleri için Diyanet verisiyle günlük ve aylık namaz vakitleri, ezan saatleri ve kıble saati.",
    crumbs: [["Hakyol", "/"], rootCrumb],
    body: `<h1>Namaz Vakitleri</h1>
<p class="date">81 il ve ${iller.reduce((n, il) => n + il.ilceler.length, 0)} ilçe için Diyanet verisiyle ezan saatleri. İlinizi seçin.</p>
<div data-city-search data-index="${BASE_PATH}/arama.json" data-placeholder="İl, ilçe veya şehir ara" data-no-results="Sonuç yok"></div>
${turkeyMapHtml}
<ul class="links">${liveIller.map((il) => `<li><a href="${BASE_PATH}/${il.slug}/">${esc(il.name)}</a></li>`).join("")}</ul>
<h2 class="sec">Yurt dışı namaz vakitleri</h2>
${countries.map((country) => `<h3><a href="${BASE_PATH}/${country.slug}/">${esc(country.name)}</a></h3><ul class="links">${country.cities.filter((city) => city.rows).slice(0, 5).map((city) => `<li><a href="${BASE_PATH}/${country.slug}/${city.slug}/">${esc(city.name)}</a></li>`).join("")}</ul>`).join("")}
${cta("Bulunduğunuz yer", "city_hub")}`,
    ld: [breadcrumbLd([["Hakyol", "/"], rootCrumb])],
    turkeyMap: true,
  })
);

function searchKey(parts) {
  const aliases = { "münih": "munchen" };
  const text = normalizeSearch(parts.join(" "));
  return `${text} ${aliases[parts[0].toLocaleLowerCase("tr-TR")] || ""}`.trim().replace(/\s+/g, " ");
}
const searchIndex = [];
for (const il of liveIller) {
  searchIndex.push([il.name, "Türkiye", `${BASE_PATH}/${il.slug}/`, searchKey([il.name, "Türkiye"])]);
  for (const district of il.ilceler) searchIndex.push([district.name, il.name, `${BASE_PATH}/${il.slug}/${district.slug}/`, searchKey([district.name, il.name])]);
}
for (const country of countries) {
  searchIndex.push([country.name, "Yurt dışı", `${BASE_PATH}/${country.slug}/`, searchKey([country.name])]);
  for (const city of country.cities.filter((item) => item.rows)) searchIndex.push([city.name, country.name, `${BASE_PATH}/${country.slug}/${city.slug}/`, searchKey([city.name, city.alias || "", country.name])]);
}
fs.writeFileSync(path.join(OUT_DIR, "arama.json"), JSON.stringify(searchIndex));

// Bölümün site haritası (robots.txt'te ayrı Sitemap satırı)
const xml =
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map((u) => `  <url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq></url>`).join("\n") +
  `\n</urlset>\n`;
fs.writeFileSync(path.join(ROOT, "sitemap-namaz.xml"), xml);

console.log(`namaz-vakitleri: ${urls.length} sayfa (${iller.length} il), sitemap-namaz.xml`);
