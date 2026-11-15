const test = require("node:test");
const assert = require("node:assert/strict");

const { slugify, matchCities } = require("../scripts/build-dunya-list");

test("slugify preserves no accents and folds German/Turkish letters", () => {
  assert.equal(slugify("München"), "munchen");
  assert.equal(slugify("Baden-Baden"), "baden-baden");
  assert.equal(slugify("İsviçre"), "isvicre");
});

test("matchCities ranks by population and uses one Diyanet district per GeoNames city", () => {
  const districts = [
    { IlceID: "1", IlceAdi: "MUNIH" },
    { IlceID: "2", IlceAdi: "MÜNCHEN" },
    { IlceID: "3", IlceAdi: "KÖLN" },
  ];
  const geo = [
    { name: "Munich", asciiname: "Munich", alternatenames: "Munich,Munchen,Münih", population: 1500000, lat: 48.1, lng: 11.5 },
    { name: "Köln", asciiname: "Cologne", alternatenames: "Cologne,Koln,Köln", population: 1000000, lat: 50.9, lng: 6.9 },
  ];
  assert.deepEqual(matchCities(districts, geo, 5), [
    { slug: "munih", name: "Münih", ilceId: "1", pop: 1500000, lat: 48.1, lng: 11.5, alias: "Munich" },
    { slug: "koln", name: "Köln", ilceId: "3", pop: 1000000, lat: 50.9, lng: 6.9 },
  ]);
});

test("matchCities drops districts that are not separate cities", () => {
  const geo = [{ name: "Brooklyn", asciiname: "Brooklyn", alternatenames: "", population: 2500000, lat: 40.6, lng: -73.9 }];
  assert.deepEqual(matchCities([{ IlceID: "9", IlceAdi: "BROOKLYN" }], geo, 5), []);
});
