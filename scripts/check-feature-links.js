/** Yeni Türkçe özellik sayfalarındaki kök göreli iç bağlantıları denetler. */
const fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,".."),roots=["cuma-namazi-saati","kible-yonu","hicri-takvim","sitenize-ekleyin","de/gebetszeiten-widget","imsakiye","id/jadwal-imsakiyah","ur/ramzan-timings","bn/ramadan-calendar","fa/ramazan","ar/imsakiya"],pages=[],missing=[];
function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(e.name==="index.html")pages.push(p)}}
for(const r of roots)walk(path.join(ROOT,r));
for(const f of pages){const html=fs.readFileSync(f,"utf8");for(const m of html.matchAll(/(?:href|src)="(\/[^"#]+)"/g)){const u=m[1].split(/[?#]/)[0];if(u==="/"||/\.(png|css|js|html|webmanifest)$/.test(u))continue;const direct=path.join(ROOT,u),index=path.join(direct,"index.html");if(!fs.existsSync(direct)&&!fs.existsSync(index))missing.push([path.relative(ROOT,f),u])}}
console.log(`feature_pages=${pages.length} internal_missing=${missing.length}`);if(missing.length){console.log(missing.slice(0,30));process.exitCode=1}
