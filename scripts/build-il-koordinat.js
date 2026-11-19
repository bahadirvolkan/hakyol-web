#!/usr/bin/env node
/** GeoNames TR.zip içindeki 81 il merkezi (PPLA) kaydını data/il-koordinat.json'a yazar. */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const zip = process.argv[2];
if (!zip) throw new Error("Kullanım: node scripts/build-il-koordinat.js /path/to/TR.zip");
const fold = (s) => s.toLocaleLowerCase("tr").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i").replace(/[^a-z0-9]/g, "");
const official = JSON.parse(fs.readFileSync(path.join(ROOT, "data/diyanet-tr.json"), "utf8"));
const rows = execFileSync("unzip", ["-p", zip, "TR.txt"], { encoding: "utf8", maxBuffer: 80 * 1024 * 1024 })
  .trim().split("\n").map((line) => line.split("\t"))
  .filter((r) => r[6] === "P" && (r[7] === "PPLA" || r[7] === "PPLC"));
const seatByProvince = { hatay: "antakya", kocaeli: "izmit", sakarya: "adapazari" };
const byName = new Map(rows.map((r) => [fold(r[1]), r]));
const output = {};
for (const city of official) {
  const province = fold(city.sehir), key = seatByProvince[province] || province, row = byName.get(key);
  if (!row) throw new Error(`GeoNames eşleşmesi yok: ${city.sehir}`);
  const lat = Number(row[4]), lng = Number(row[5]);
  if (lat < 35.8 || lat > 42.2 || lng < 25.5 || lng > 45.0) throw new Error(`Türkiye sınırı dışında: ${city.sehir}`);
  output[city.sehir] = { lat, lng, geonameId: Number(row[0]) };
}
if (Object.keys(output).length !== 81) throw new Error(`81 il bekleniyordu: ${Object.keys(output).length}`);
fs.writeFileSync(path.join(ROOT, "data/il-koordinat.json"), JSON.stringify({ source: "GeoNames TR dump, CC BY 4.0", generated: new Date().toISOString(), iller: output }, null, 2) + "\n");
console.log("il-koordinat: 81/81, tümü Türkiye sınırları içinde");
