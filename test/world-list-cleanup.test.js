const test = require("node:test");
const assert = require("node:assert/strict");

const { cleanLocalName, cleanAdmin1, removeNearbyCities } = require("../scripts/build-world-list");

test("cleanLocalName removes Arabic marks and normalizes Persian and Urdu letters", () => {
  assert.equal(cleanLocalName("مَكَّـة\u200f", "ar"), "مكة");
  assert.equal(cleanLocalName("كِرمانشاه", "fa"), "کرمانشاه");
  assert.equal(cleanLocalName("لاھور", "ur"), "لاہور");
});

test("cleanLocalName removes administrative prefixes, suffixes, and comma details", () => {
  assert.equal(cleanLocalName("Daerah Istimewa Yogyakarta", "id"), "Yogyakarta");
  assert.equal(cleanLocalName("Kota Surabaya", "id"), "Surabaya");
  assert.equal(cleanLocalName("حیدرآباد، سندھ", "ur"), "حیدرآباد");
  assert.equal(cleanLocalName("রংপুর উপজেলা", "bn"), "রংপুর");
  assert.equal(cleanLocalName("নেত্রকোণা জেলা", "bn"), "নেত্রকোণা");
  assert.equal(cleanLocalName("চাঁদপুর সদর উপজেলা", "bn"), "চাঁদপুর");
  assert.equal(cleanLocalName("নাগরপুর ইউনিয়ন", "bn"), "নাগরপুর");
  assert.equal(cleanLocalName("شهرک قدس", "fa"), "شهرک قدس");
  assert.equal(cleanLocalName("گلگت ضلع", "ur"), "گلگت");
  assert.equal(cleanLocalName("شهرستان بابل", "fa"), "بابل");
  assert.equal(cleanLocalName("Kabupaten Buol", "id"), "Buol");
  assert.equal(cleanLocalName("Bandar Abbas", "id"), "Bandar Abbas");
});

test("admin1 adları idari önek ve bölüm eklerinden arındırılır", () => {
  assert.equal(cleanAdmin1("Provinsi Nusa Tenggara Barat", "id"), "Nusa Tenggara Barat");
  assert.equal(cleanAdmin1("Mymensingh Division", "bn"), "Mymensingh");
  assert.equal(cleanAdmin1("ময়মনসিংহ বিভাগ", "bn"), "ময়মনসিংহ");
  assert.equal(cleanAdmin1("Rājshāhi Bibhag", "bn"), "Rājshāhi");
  assert.equal(cleanAdmin1("Daerah Tingkat I Sumatera Utara", "id"), "Sumatera Utara");
});

test("üretilen görünen adlarda idari önek ve sonek kalmaz", () => {
  const data = require("../data/world-cities.json");
  for (const country of data.countries) for (const city of country.cities) {
    assert.doesNotMatch(city.name, /^(?:Kabupaten |Kota |شهرستان )|(?: জেলা| উপজেলা| সদর| ضلع)$/u, `${country.cc}/${city.slug}`);
    assert.doesNotMatch(city.admin1 || "", /^(?:Propinsi |Provinsi |Daerah Tingkat I )|(?: Division| বিভাগ| Bibhag)$/iu, `${country.cc}/${city.slug}`);
  }
});

test("Arap yazılı dillerde şehir ve admin1 Latin harf içermez", () => {
  const data = require("../data/world-cities.json");
  for (const country of data.countries.filter((x) => ["ur", "bn", "fa", "ar"].includes(x.lang))) for (const city of country.cities) {
    assert.doesNotMatch(city.name, /[A-Za-z]/, `${country.cc}/${city.slug} name`);
    if (city.admin1) assert.doesNotMatch(city.admin1, /[A-Za-z]/, `${country.cc}/${city.slug} admin1`);
  }
});

test("removeNearbyCities drops only a lower-population city within 12 km", () => {
  const cities = [
    { asciiname: "Large", pop: 200000, lat: 0, lng: 0 },
    { asciiname: "Near", pop: 100000, lat: 0, lng: 0.1 },
    { asciiname: "Far", pop: 90000, lat: 0, lng: 0.2 },
    { asciiname: "Equal", pop: 200000, lat: 0, lng: 0.05 },
  ];
  assert.deepEqual(removeNearbyCities(cities).map((city) => city.asciiname), ["Large", "Equal", "Far"]);
});

test("removeNearbyCities never drops a protected required city", () => {
  const cities = [
    { asciiname: "Large", pop: 200000, lat: 0, lng: 0, geonameId: 1 },
    { asciiname: "Capital", pop: 100000, lat: 0, lng: 0.05, geonameId: 2 },
  ];
  assert.deepEqual(
    removeNearbyCities(cities, new Set(["capital"])).map((city) => city.asciiname),
    ["Large", "Capital"],
  );
});
