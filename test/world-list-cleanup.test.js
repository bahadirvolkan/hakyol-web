const test = require("node:test");
const assert = require("node:assert/strict");

const { cleanLocalName, removeNearbyCities } = require("../scripts/build-world-list");

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
  assert.equal(cleanLocalName("Bandar Abbas", "id"), "Bandar Abbas");
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
