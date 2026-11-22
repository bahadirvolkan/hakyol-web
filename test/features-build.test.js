const test=require("node:test"),assert=require("node:assert/strict"),fs=require("fs"),path=require("path");
const {validateApiPayload}=require("../lib/features");
const ROOT=path.join(__dirname,"..");
function files(dir,name="index.html",out=[]){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())files(p,name,out);else if(e.name===name)out.push(p)}return out}

test("GeoNames verisi 81 il merkezini Türkiye sınırlarında içerir",()=>{
  const x=require("../data/il-koordinat.json"),rows=Object.values(x.iller);
  assert.equal(rows.length,81);
  assert.equal(rows.every(p=>p.lat>=35.8&&p.lat<=42.2&&p.lng>=25.5&&p.lng<=45),true);
});

test("üretilen tüm vakit API dosyaları şemaya uyar ve indeksle bire birdir",()=>{
  const dir=path.join(ROOT,"api/vakit"),json=[];
  (function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(e.name.endsWith(".json")&&!/^index(?:-|\.)/.test(e.name))json.push(p)}})(dir);
  for(const f of json)assert.equal(validateApiPayload(JSON.parse(fs.readFileSync(f))),true,path.relative(ROOT,f));
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir,"index.json"))).length,json.length);
  const world=require("../data/world-cities.json").countries.reduce((n,c)=>n+c.cities.length,0);
  assert.equal(json.filter(f=>f.includes(`${path.sep}w${path.sep}`)).length,world);
});

test("cuma kıble hicri ve widget hazırlama sayfaları üretilir",()=>{
  assert.equal(files(path.join(ROOT,"cuma-namazi-saati")).length,82);
  assert.equal(files(path.join(ROOT,"kible-yonu")).length,328);
  assert.equal(fs.existsSync(path.join(ROOT,"hicri-takvim/index.html")),true);
  assert.equal(fs.existsSync(path.join(ROOT,"sitenize-ekleyin/index.html")),true);
  assert.equal(fs.existsSync(path.join(ROOT,"de/gebetszeiten-widget/index.html")),true);
  for(const p of ["id/widget-jadwal-sholat","ur/namaz-timings-widget","bn/namaz-somoy-widget"])assert.equal(fs.existsSync(path.join(ROOT,p,"index.html")),true);
});

test("dünya üretimi eski slug dizinlerini bırakmaz",()=>{
  const world=require("../data/world-cities.json"),roots={id:"jadwal-sholat",bn:"namaz-er-somoy",ur:"namaz-ke-auqat",ar:"mawaqit-al-salat",fa:"owghat-sharei"};
  const actual=Object.entries(roots).reduce((n,[lang,root])=>n+files(path.join(ROOT,lang,root)).length,0);
  const expected=world.countries.reduce((n,c)=>n+c.cities.length,0)+Object.keys(roots).length+world.countries.filter(c=>["ar","fa"].includes(c.lang)).length;
  assert.equal(actual,expected);
});

test("sitemap yeni sayfaları içerir ama API ve widget betiğini içermez",()=>{
  const x=fs.readFileSync(path.join(ROOT,"sitemap-namaz.xml"),"utf8");
  for(const u of ["/cuma-namazi-saati/","/kible-yonu/","/hicri-takvim/","/sitenize-ekleyin/"])assert.match(x,new RegExp(u.replaceAll("/","\\/")));
  assert.doesNotMatch(x,/\/api\/|widget\.js/);
});
