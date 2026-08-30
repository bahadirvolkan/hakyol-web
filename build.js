/**
 * hakyol.app build — generates per-language static pages from src/index.html.
 *
 *   node build.js
 *
 * Output: /index.html (tr, root), /en/index.html, /ar/index.html, ... plus a
 * regenerated sitemap.xml. GitHub Pages serves the files as-is.
 *
 * Source of truth: src/index.html (all 7 langs, data-i18n attributes) +
 * src/meta.json (per-language <head> strings, badge labels).
 */
const fs = require("fs");
const path = require("path");
const { parse } = require("node-html-parser");

const ROOT = __dirname;
const SRC = path.join(ROOT, "src", "index.html");
const META = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "meta.json"), "utf8"));
const SITE = "https://hakyol.app";
const LANGS = META.langs;
const RTL = new Set(META.rtl);
const APP_ID = "6794740149";
const PKG = "com.bahadir.hakyol";

const PW_CSS = `
  .pw-wrap { padding: 8px 0 32px; }
  #prayer-widget { background: var(--card); border: 1px solid var(--card-border);
    border-radius: 18px; padding: 22px 24px; max-width: 560px; margin: 0 auto; text-align: center; }
  .pw-h { font-family: var(--serif); font-size: 20px; margin: 0 0 4px; color: var(--gold-text); }
  .pw-city { margin: 0 0 16px; color: var(--text-soft); font-size: 14px; }
  .pw-city strong { color: var(--text); }
  .pw-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .pw-row { background: var(--gold-soft); border-radius: 12px; padding: 10px 6px; }
  .pw-name { display: block; font-size: 12px; color: var(--text-faint); letter-spacing: .3px; }
  .pw-time { display: block; font-family: var(--mono); font-size: 18px; color: var(--text); margin-top: 2px; }
  .pw-disc { margin: 16px 0 0; font-size: 12px; line-height: 1.5; color: var(--text-faint); }
  .pw-msg { color: var(--text-soft); font-size: 14px; margin: 4px 0 14px; }
  .pw-btn { appearance: none; border: 1px solid var(--gold); background: var(--gold);
    color: #241a04; font-family: var(--sans); font-weight: 700; font-size: 13px;
    padding: 9px 18px; border-radius: 999px; cursor: pointer; }
  @media (max-width: 480px) { .pw-grid { grid-template-columns: repeat(2, 1fr); }
    #prayer-widget { padding: 18px 14px; } }
`;

// language -> output directory ("" = repo root)
const outDir = (lang) => (lang === "tr" ? "" : lang);
const urlFor = (lang) => (lang === "tr" ? `${SITE}/` : `${SITE}/${lang}/`);

function hreflangCluster(selfLang) {
  const lines = LANGS.map(
    (l) => `<link rel="alternate" hreflang="${l}" href="${urlFor(l)}" />`
  );
  lines.push(`<link rel="alternate" hreflang="x-default" href="${SITE}/" />`);
  return lines.join("\n");
}

function jsonLd(lang) {
  const p = META.pages.index[lang];
  const obj = {
    "@context": "https://schema.org",
    "@type": "MobileApplication",
    name: "Hakyol",
    operatingSystem: "iOS, Android",
    applicationCategory: "LifestyleApplication",
    inLanguage: lang,
    description: p.description,
    url: urlFor(lang),
    image: `${SITE}/og-image.png`,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    downloadUrl: [
      `https://apps.apple.com/app/hakyol/id${APP_ID}`,
      `https://play.google.com/store/apps/details?id=${PKG}`,
    ],
    author: { "@type": "Organization", name: "Hakyol", url: SITE },
  };
  const r = META.aggregateRating;
  if (r && r.ratingValue != null && r.ratingCount != null && r.ratingCount >= 5) {
    obj.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: String(r.ratingValue),
      ratingCount: String(r.ratingCount),
    };
  }
  return `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
}

function storeLinks(lang) {
  const b = META.badges[lang];
  const appStore =
    `https://apps.apple.com/app/hakyol/id${APP_ID}` +
    `?ct=hakyol_web_${lang}&mt=8`;
  const play =
    `https://play.google.com/store/apps/details?id=${PKG}` +
    `&referrer=utm_source%3Dhakyol.app%26utm_medium%3Dweb%26utm_campaign%3Dlanding_${lang}`;
  return { appStore, play, b };
}

function buildLang(lang) {
  const root = parse(fs.readFileSync(SRC, "utf8"), {
    comment: true,
    blockTextElements: { script: true, style: true, pre: true },
  });
  const html = root.querySelector("html");
  const head = root.querySelector("head");
  const dir = RTL.has(lang) ? "rtl" : "ltr";

  html.setAttribute("lang", lang);
  html.setAttribute("dir", dir);
  html.setAttribute("data-lang", lang); // static — CSS shows this lang's data-i18n nodes

  // 1. drop every other language's translatable nodes (page becomes single-language)
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    if (el.getAttribute("data-i18n") !== lang) el.remove();
  });

  // 2. rebuild <head> meta
  const p = META.pages.index[lang];
  head.querySelector("title") &&
    (head.querySelector("title").set_content(p.title));
  const setMeta = (sel, attr, val) => {
    const el = head.querySelector(sel);
    if (el) el.setAttribute(attr, val);
  };
  setMeta('meta[name="description"]', "content", p.description);
  setMeta('link[rel="canonical"]', "href", urlFor(lang));
  setMeta('meta[property="og:url"]', "content", urlFor(lang));
  setMeta('meta[property="og:title"]', "content", p.title);
  setMeta('meta[property="og:description"]', "content", p.description);
  setMeta('meta[property="og:locale"]', "content", META.ogLocale[lang]);
  setMeta('meta[name="twitter:title"]', "content", p.title);
  setMeta('meta[name="twitter:description"]', "content", p.description);

  // og:site_name + image:alt if missing
  if (!head.querySelector('meta[property="og:site_name"]')) {
    head
      .querySelector('meta[property="og:locale"]')
      .insertAdjacentHTML(
        "afterend",
        `\n<meta property="og:site_name" content="Hakyol" />`
      );
  }

  // 3. hreflang + JSON-LD + favicon set + webmanifest, injected before </head>
  head.querySelectorAll('link[rel="icon"]').forEach((l) => l.remove()); // old emoji SVG
  const faviconBlock = [
    `<link rel="icon" type="image/png" sizes="32x32" href="${SITE}/favicon-32.png" />`,
    `<link rel="icon" type="image/png" sizes="16x16" href="${SITE}/favicon-16.png" />`,
    `<link rel="apple-touch-icon" sizes="180x180" href="${SITE}/apple-touch-icon.png" />`,
    `<link rel="manifest" href="${SITE}/site.webmanifest" />`,
  ].join("\n");
  head.insertAdjacentHTML(
    "beforeend",
    "\n" + hreflangCluster(lang) + "\n" + faviconBlock + "\n" + jsonLd(lang) + "\n"
  );

  // 4. language switcher: buttons -> links to the per-language URLs
  root.querySelectorAll(".lang-switch button").forEach((btn) => {
    const l = btn.getAttribute("data-set-lang");
    const a = parse(
      `<a class="${btn.getAttribute("class") || ""}${
        l === lang ? " active" : ""
      }" href="${l === "tr" ? "/" : "/" + l + "/"}">${btn.innerHTML}</a>`
    ).firstChild;
    btn.replaceWith(a);
  });

  // 5. store badges: localized labels + UTM, fix App Store storefront
  const { appStore, play, b } = storeLinks(lang);
  const badges = root.querySelectorAll(".store-badge");
  if (badges[0]) {
    badges[0].setAttribute("href", appStore);
    const small = badges[0].querySelector(".small");
    const big = badges[0].querySelector(".big");
    if (small) small.set_content(b.appstore_small);
    if (big) big.set_content(b.appstore_big);
  }
  if (badges[1]) {
    badges[1].setAttribute("href", play);
    const small = badges[1].querySelector(".small");
    const big = badges[1].querySelector(".big");
    if (small) small.set_content(b.play_small);
    if (big) big.set_content(b.play_big);
  }

  // 6. drop the now-obsolete JS language switcher <script>
  root.querySelectorAll("script").forEach((s) => {
    if (/hakyol_lang|data-set-lang|setLang\(/.test(s.innerHTML)) s.remove();
  });

  // 7. make bare-relative asset/page refs root-relative (pages live in /<lang>/)
  root.querySelectorAll("[src],[href]").forEach((el) => {
    for (const attr of ["src", "href"]) {
      const v = el.getAttribute(attr);
      if (v && !/^(https?:|\/|#|mailto:|data:)/.test(v)) {
        el.setAttribute(attr, "/" + v);
      }
    }
  });

  // 8. CSS switcher rules target <button>; switcher is now <a>
  root.querySelectorAll("style").forEach((st) => {
    if (st.innerHTML.includes(".lang-switch button")) {
      st.set_content(st.innerHTML.replace(/\.lang-switch button/g, ".lang-switch a"));
    }
  });

  // 9. today's prayer times widget — inject section after the hero, CSS + scripts
  const header = root.querySelector("header.hero");
  if (header) {
    header.insertAdjacentHTML(
      "afterend",
      '\n<section class="pw-wrap"><div class="wrap"><div id="prayer-widget"></div></div></section>\n'
    );
  }
  root.querySelectorAll("style").forEach((st) => {
    if (st.innerHTML.includes(":root")) {
      st.set_content(st.innerHTML + "\n" + PW_CSS);
    }
  });
  root.querySelector("body").insertAdjacentHTML(
    "beforeend",
    '\n<script src="/js/adhan.min.js"></script>\n<script src="/js/prayer-widget.js"></script>\n'
  );

  const dest = path.join(ROOT, outDir(lang), "index.html");
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, "<!doctype html>\n" + root.toString());
  return dest;
}

function buildSitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const subPages = ["user-guide", "terms", "privacy-policy", "kvkk-aydinlatma-metni"];
  const urls = [];
  // language home pages with hreflang alternates
  for (const lang of LANGS) {
    const alts = LANGS.map(
      (l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${urlFor(l)}"/>`
    ).join("\n");
    urls.push(
      `  <url>\n    <loc>${urlFor(lang)}</loc>\n    <lastmod>${today}</lastmod>\n${alts}\n` +
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}/"/>\n  </url>`
    );
  }
  for (const s of subPages) {
    urls.push(`  <url>\n    <loc>${SITE}/${s}.html</loc>\n    <lastmod>${today}</lastmod>\n  </url>`);
  }
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ` +
    `xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join("\n")}\n</urlset>\n`;
  fs.writeFileSync(path.join(ROOT, "sitemap.xml"), xml);
}

// --- run ---
const built = LANGS.map(buildLang);
buildSitemap();
fs.writeFileSync(path.join(ROOT, ".nojekyll"), "");
console.log("built:\n" + built.map((f) => "  " + path.relative(ROOT, f)).join("\n"));
console.log("  sitemap.xml\n  .nojekyll");
