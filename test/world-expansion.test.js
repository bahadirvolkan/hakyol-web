const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  isEligible,
  removeNearbyCities,
  reserveStableSlugs,
  buildCountries,
  mergeStableCities,
} = require("../scripts/build-world-list");
const { nearestCities, worldApiRows } = require("../build-world");

test("genişletilen ülkeler idari merkezleri ve nüfus eşiklerini seçer", () => {
  assert.equal(isEligible({ cc: "ID", featureCode: "PPLA2", pop: 1200 }), true);
  assert.equal(isEligible({ cc: "ID", featureCode: "PPL", pop: 74999 }), false);
  assert.equal(isEligible({ cc: "ID", featureCode: "PPL", pop: 75000 }), true);
  assert.equal(isEligible({ cc: "PK", featureCode: "PPLA2", pop: 1000 }), true);
  assert.equal(isEligible({ cc: "BD", featureCode: "PPL", pop: 49999 }), false);
  assert.equal(isEligible({ cc: "IR", featureCode: "PPL", pop: 40000 }), true);
});

test("PPLA2 yakınlık temizliğinde korunur", () => {
  const cities = [
    { asciiname: "Large", featureCode: "PPL", pop: 200000, lat: 0, lng: 0 },
    { asciiname: "Seat", featureCode: "PPLA2", pop: 1000, lat: 0, lng: 0.01 },
  ];
  assert.deepEqual(removeNearbyCities(cities).map((x) => x.asciiname), ["Large", "Seat"]);
});

test("eski geonameId slugları aynen korunur, çakışan yeni slug admin1 alır", () => {
  const old = [{ geonameId: 1, slug: "malang" }];
  const rows = [
    { geonameId: 1, asciiname: "Malang", admin1Ascii: "East Java" },
    { geonameId: 2, asciiname: "Malang", admin1Ascii: "West Java" },
  ];
  reserveStableSlugs(rows, old);
  assert.equal(rows[0].slug, "malang");
  assert.equal(rows[1].slug, "malang-west-java");
});

test("asciiName tabanlı slug geçerlidir; bozuk eski slug korunmaz", () => {
  const rows = [
    { geonameId: 1, asciiName: "Buol", admin1Ascii: "Central Sulawesi" },
    { geonameId: 2, asciiName: "Kota X", admin1Ascii: "Jawa Barat" },
    { geonameId: 3, asciiName: "Kota X", admin1Ascii: "Jawa Timur" },
  ];
  reserveStableSlugs(rows, [{ geonameId: 1, slug: "-1647574" }]);
  assert.deepEqual(rows.map((x) => x.slug), ["buol", "kota-x", "kota-x-jawa-timur"]);
});

test("üretilen tüm sluglar ülke içinde geçerli ve benzersizdir; eski geçerli sluglar sabittir", () => {
  const current = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/world-cities.json")));
  const committed = require("./fixtures/world-cities-2026-11-22.json");
  for (const country of current.countries) {
    const slugs = country.cities.map((x) => x.slug);
    assert.equal(slugs.every((x) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(x)), true, country.cc);
    assert.equal(new Set(slugs).size, slugs.length, country.cc);
    const old = new Map((committed.countries.find((x) => x.cc === country.cc)?.cities || []).map((x) => [x.geonameId, x.slug]));
    for (const city of country.cities) if (old.has(city.geonameId)) assert.equal(city.slug, old.get(city.geonameId), `${country.cc}/${city.geonameId}`);
  }
});

test("canlı fixture'daki her URL aynı geonameId ve koordinatla korunur", () => {
  const current = require("../data/world-cities.json"), stable = require("./fixtures/world-cities-2026-11-22.json");
  for (const oldCountry of stable.countries) {
    const country = current.countries.find((x) => x.cc === oldCountry.cc);
    for (const old of oldCountry.cities) {
      const city = country.cities.find((x) => x.slug === old.slug);
      assert.ok(city, `${oldCountry.cc}/${old.slug}`);
      assert.equal(city.geonameId, old.geonameId, `${oldCountry.cc}/${old.slug} geonameId`);
      assert.equal(city.lat, old.lat, `${oldCountry.cc}/${old.slug} lat`);
      assert.equal(city.lng, old.lng, `${oldCountry.cc}/${old.slug} lng`);
      assert.equal(city.pop, old.pop, `${oldCountry.cc}/${old.slug} pop`);
    }
  }
});

test("sabit şehir dump'ta yoksa geri eklenir ve homonim nüfusu başka geonameId'ye taşınmaz", () => {
  const live = { slug: "sahiwal", name: "ساہیوال", asciiName: "Sahiwal", geonameId: 1166548, lat: 30.66595, lng: 73.10186, tz: "Asia/Karachi", pop: 538344 };
  const dump = [{ cc: "PK", geonameId: 1166547, name: "Sahiwal", asciiname: "Sahiwal", lat: 31.97386, lng: 72.33109, featureCode: "PPLA2", admin1Code: "04", pop: 12000, tz: "Asia/Karachi" }];
  const merged = mergeStableCities(dump, { countries: [{ cc: "PK", cities: [live] }] });
  assert.equal(merged.find((x) => x.geonameId === 1166548).pop, 538344);
  assert.equal(merged.find((x) => x.geonameId === 1166547).pop, 12000);
});

test("İran'da PPLA korunur, nüfusu 10 bin altı PPLA2 alınmaz", () => {
  assert.equal(isEligible({ cc: "IR", featureCode: "PPLA", pop: 0 }), true);
  assert.equal(isEligible({ cc: "IR", featureCode: "PPLA2", pop: 9999 }), false);
});

test("GeoNames adı yoksa PK ve BD için yerel Wikidata etiketi kullanılır", () => {
  const cities = [{ cc: "PK", geonameId: 9, name: "Chilas", asciiname: "Chilas", lat: 1, lng: 2, featureCode: "PPLA2", admin1Code: "01", pop: 20000, tz: "Asia/Karachi" }];
  const alternatives = { PK: new Map() };
  const wikidata = new Map([[9, "چلاس"]]);
  const previous = { countries: [{ cc: "PK", cities: [] }] };
  const country = buildCountries(cities, alternatives, new Map(), previous, wikidata).find((x) => x.cc === "PK");
  assert.equal(country.cities[0].name, "چلاس");
});

test("yakındaki şehirler kendisini içermez, aynı ülkeden en yakınları döndürür", () => {
  const city = { geonameId: 1, lat: 0, lng: 0 };
  const same = [city, { geonameId: 2, lat: 0, lng: 1 }, { geonameId: 3, lat: 0, lng: 2 }];
  assert.deepEqual(nearestCities(city, same, 1).map((x) => x.city.geonameId), [2]);
});

test("dünya API satırları yerel tarihin dünden başlar ve en az 32 gündür", () => {
  const country = { lang: "id", method: "kemenag" };
  const city = { lat: -6.2, lng: 106.8, tz: "Asia/Jakarta" };
  const now = new Date("2026-11-22T20:00:00Z");
  const rows = worldApiRows(country, city, now);
  assert.equal(rows.length >= 32, true);
  assert.equal(rows[0][0], "2026-11-22");
  assert.equal(rows[0].length, 7);
});
