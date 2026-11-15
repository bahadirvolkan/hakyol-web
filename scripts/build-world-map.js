#!/usr/bin/env node
const fs = require("fs");
const https = require("https");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const zlib = require("zlib");

const ROOT = path.join(__dirname, "..");
const SOURCE = "https://naciscdn.org/naturalearth/110m/cultural/ne_110m_admin_0_countries.zip";
const OUT = path.join(ROOT, "data", "dunya-ulkeler.svg.json");
const SVG_OUT = path.join(ROOT, "maps", "dunya.svg");
const VIEW_BOX = "130 50 675 205";
const ACTIVE = {
  DEU: ["Almanya", "/namaz-vakitleri/almanya/"], NLD: ["Hollanda", "/namaz-vakitleri/hollanda/"], BEL: ["Belçika", "/namaz-vakitleri/belcika/"],
  FRA: ["Fransa", "/namaz-vakitleri/fransa/"], AUT: ["Avusturya", "/namaz-vakitleri/avusturya/"], CHE: ["İsviçre", "/namaz-vakitleri/isvicre/"],
  GBR: ["İngiltere", "/namaz-vakitleri/ingiltere/"], USA: ["ABD", "/namaz-vakitleri/abd/"], AZE: ["Azerbaycan", "/namaz-vakitleri/azerbaycan/"],
  SWE: ["İsveç", "/namaz-vakitleri/isvec/"], DNK: ["Danimarka", "/namaz-vakitleri/danimarka/"], TUR: ["Türkiye", "/namaz-vakitleri/"],
  IDN: ["Endonezya", "/id/jadwal-sholat/"], BGD: ["Bangladeş", "/bn/namaz-er-somoy/"], PAK: ["Pakistan", "/ur/namaz-ke-auqat/"],
  SAU: ["S. Arabistan", "/ar/mawaqit-al-salat/saudi-arabia/"], ARE: ["BAE", "/ar/mawaqit-al-salat/uae/"], QAT: ["Katar", "/ar/mawaqit-al-salat/qatar/"],
  KWT: ["Kuveyt", "/ar/mawaqit-al-salat/kuwait/"], EGY: ["Mısır", "/ar/mawaqit-al-salat/egypt/"], JOR: ["Ürdün", "/ar/mawaqit-al-salat/jordan/"],
  IRN: ["İran", "/fa/owghat-sharei/iran/"], AFG: ["Afganistan", "/fa/owghat-sharei/afghanistan/"],
};
const LABELS = new Set(["USA", "TUR", "IRN", "PAK", "AFG", "SAU", "EGY", "IDN", "FRA", "DEU", "SWE"]);
const LABEL_OFFSET = { AFG: [0, -12], PAK: [0, 7], EGY: [-5, 0] };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const number = (n) => String(Math.round(n * 10) / 10).replace("-0", "0");
const project = ([lon, lat]) => [(lon + 180) * 2.5, (90 - lat) * 2.5];

function download(url, dest) {
  return new Promise((resolve, reject) => https.get(url, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) { res.resume(); return download(new URL(res.headers.location, url).href, dest).then(resolve, reject); }
    if (res.statusCode !== 200) return reject(new Error(`Natural Earth indirme hatası: HTTP ${res.statusCode}`));
    const file = fs.createWriteStream(dest); res.pipe(file); file.on("finish", () => file.close(resolve)); file.on("error", reject);
  }).on("error", reject));
}
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.status !== 0) throw new Error(`${command} başarısız oldu (${result.status})`);
}
function polygons(geometry) { return geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates; }
function distance(x, y, polygon) {
  let inside = false, min = Infinity;
  for (const ring of polygon) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    const dx = b[0] - a[0], dy = b[1] - a[1], t = dx || dy ? Math.max(0, Math.min(1, ((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy))) : 0;
    min = Math.min(min, (x-a[0]-dx*t)**2 + (y-a[1]-dy*t)**2);
  }
  return (inside ? 1 : -1) * Math.sqrt(min);
}
function polylabel(polygon) {
  const outer = polygon[0]; let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for (const [x,y] of outer) { minX=Math.min(minX,x); minY=Math.min(minY,y); maxX=Math.max(maxX,x); maxY=Math.max(maxY,y); }
  const size=Math.min(maxX-minX,maxY-minY), cells=[];
  const make=(x,y,h)=>{const d=distance(x,y,polygon);return{x,y,h,d,max:d+h*Math.SQRT2}};
  if (!size) return make(minX,minY,0);
  for(let x=minX;x<maxX;x+=size)for(let y=minY;y<maxY;y+=size)cells.push(make(x+size/2,y+size/2,size/2));
  let best=make(outer.reduce((n,p)=>n+p[0],0)/outer.length,outer.reduce((n,p)=>n+p[1],0)/outer.length,0);
  while(cells.length){cells.sort((a,b)=>a.max-b.max);const c=cells.pop();if(c.d>best.d)best=c;if(c.max-best.d<=.5)continue;const h=c.h/2;cells.push(make(c.x-h,c.y-h,h),make(c.x+h,c.y-h,h),make(c.x-h,c.y+h,h),make(c.x+h,c.y+h,h));}
  return best;
}

function assertLabelsDoNotOverlap(labels) {
  const boxes = labels.map(({ iso, name, x, y }) => ({ iso, left: x - name.length * 2.6, right: x + name.length * 2.6, top: y - 5.5, bottom: y + 5.5 }));
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) throw new Error(`Dünya haritası etiketleri çakışıyor: ${a.iso}/${b.iso}`);
  }
}

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hakyol-world-map-"));
  try {
    const zip=path.join(tmp,"source.zip"), dir=path.join(tmp,"source"), geojson=path.join(tmp,"world.geojson"); fs.mkdirSync(dir);
    await download(SOURCE,zip); run("unzip",["-q",zip,"-d",dir]);
    run("npx",["--yes","mapshaper",path.join(dir,"ne_110m_admin_0_countries.shp"),"-filter",'ADM0_A3 != "ATA"',"-simplify","35%","keep-shapes","weighted","-o","format=geojson","precision=0.05",geojson],{env:{...process.env,NPM_CONFIG_CACHE:process.env.NPM_CONFIG_CACHE||path.join(os.tmpdir(),"hakyol-npm-cache")}});
    const features=JSON.parse(fs.readFileSync(geojson,"utf8")).features;
    const paths=features.map((feature)=>{
      const iso=feature.properties.ADM0_A3, projected=polygons(feature.geometry).map((polygon)=>polygon.map((ring)=>ring.map(project)));
      const d=projected.flat().map((ring)=>ring.map((p,i)=>`${i?"L":"M"}${number(p[0])} ${number(p[1])}`).join("")+"Z").join("");
      const label=projected.map(polylabel).sort((a,b)=>b.d-a.d)[0];
      return {iso,d,lx:+number(label.x),ly:+number(label.y)};
    }).sort((a,b)=>a.iso.localeCompare(b.iso));
    const output=JSON.stringify({viewBox:VIEW_BOX,paths})+"\n", raw=Buffer.byteLength(output), gzip=zlib.gzipSync(output).length;
    if(raw>60*1024||gzip>25*1024)throw new Error(`Dünya haritası boyut sınırı: ${raw} ham, ${gzip} gzip`);
    fs.mkdirSync(path.dirname(SVG_OUT),{recursive:true}); fs.writeFileSync(OUT,output);
    const labels=[];
    const body=paths.map((item)=>{const active=ACTIVE[item.iso];const countryPath=`<path d="${item.d}"/>`;if(!active)return `<g class="map-country map-passive" data-iso="${item.iso}">${countryPath}</g>`;const [name,href]=active, off=LABEL_OFFSET[item.iso]||[0,0], x=item.lx+off[0], y=item.ly+off[1];if(LABELS.has(item.iso))labels.push({iso:item.iso,name,x,y});const label="";return `<a class="map-country map-active" href="${href}" aria-label="${esc(name)} namaz vakitleri" data-map-name="${esc(name)}"><title>${esc(name)}</title>${countryPath}${label}</a>`;}).join("");
    assertLabelsDoNotOverlap(labels);
    const kx=(33.35+180)*2.5,ky=(90-35.2)*2.5;
    const marker=`<a class="map-country map-active map-marker" href="/namaz-vakitleri/kktc/" aria-label="KKTC namaz vakitleri" data-map-name="KKTC"><title>KKTC</title><circle cx="${number(kx)}" cy="${number(ky)}" r="3"/></a>`;
    const style=`<style>.map-country path{fill:#1b2740;stroke:#675b36;stroke-width:.6}.map-passive path{fill:#162136;stroke:#30394a}.map-active>path:first-of-type{fill:rgba(212,175,55,.35);stroke:#d4af37;stroke-width:.9}.map-label{fill:#fff4d6;stroke:#08101e;stroke-width:2px;paint-order:stroke;pointer-events:none;text-anchor:middle;dominant-baseline:middle;font:600 9px system-ui}.map-marker circle{fill:#d4af37;stroke:#fff4d6;stroke-width:1}.map-active:hover>path:first-of-type,.map-active:focus>path:first-of-type{fill:rgba(241,212,119,.72);stroke:#f1d477}.map-marker:hover circle,.map-marker:focus circle{fill:#f1d477}.map-active:hover .map-label,.map-active:focus .map-label{fill:#f1d477}</style>`;
    fs.writeFileSync(SVG_OUT,`<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Dünya namaz vakitleri haritası" viewBox="${VIEW_BOX}">${style}${body}${marker}<g class="map-labels" aria-hidden="true">${labels.map((l)=>`<text class="map-label" x="${number(l.x)}" y="${number(l.y)}">${esc(l.name)}</text>`).join("")}</g></svg>\n`);
    console.log(`Dünya haritası: ${paths.length} ülke, ${Object.keys(ACTIVE).length+1} bağlantı, ${raw} bayt ham, ${gzip} bayt gzip`);
  } finally { fs.rmSync(tmp,{recursive:true,force:true}); }
}
main().catch((error)=>{console.error(error.message);process.exit(1)});
