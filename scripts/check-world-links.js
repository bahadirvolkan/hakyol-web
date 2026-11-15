/** Üretilen dünya sayfalarındaki site içi href/src hedeflerini denetler. */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const roots = ["id/jadwal-sholat", "bn/namaz-er-somoy", "ur/namaz-ke-auqat", "ar/mawaqit-al-salat", "fa/owghat-sharei"];
const pages = [], missing = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.name === "index.html") pages.push(file);
  }
}
for (const root of roots) walk(path.join(ROOT, root));
for (const file of pages) {
  const html = fs.readFileSync(file, "utf8");
  for (const match of html.matchAll(/(?:href|src)="(\/[^"]+)"/g)) {
    const url = match[1].split(/[?#]/)[0], direct = path.join(ROOT, url), index = path.join(direct, "index.html");
    if (!fs.existsSync(direct) && !fs.existsSync(index)) missing.push([path.relative(ROOT, file), url]);
  }
}
console.log(`world_pages=${pages.length} internal_missing=${missing.length}`);
if (missing.length) { console.log(missing.slice(0, 20)); process.exitCode = 1; }
