const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeSearch, searchCities } = require("../js/city-search");

test("normalizeSearch folds Turkish, German and accented letters", () => {
  assert.equal(normalizeSearch("  İstanbul-Şişli  "), "istanbul sisli");
  assert.equal(normalizeSearch("München Köln Straße Évry"), "munchen koln strasse evry");
});

test("searchCities ranks prefix then word-prefix then contains and parents before children", () => {
  const rows = [
    ["İstanbul ilçesi", "İstanbul", "/namaz-vakitleri/istanbul/istanbul-ilcesi/", "istanbul ilcesi istanbul"],
    ["İstanbul", "Türkiye", "/namaz-vakitleri/istanbul/", "istanbul"],
    ["Kadıköy", "İstanbul", "/namaz-vakitleri/istanbul/kadikoy/", "kadikoy istanbul"],
    ["Köln", "Almanya", "/namaz-vakitleri/almanya/koln/", "koln cologne almanya"],
  ];
  assert.equal(searchCities(rows, "istanbul")[0][2], "/namaz-vakitleri/istanbul/");
  assert.equal(searchCities(rows, "kadikoy")[0][0], "Kadıköy");
  assert.equal(searchCities(rows, "koln")[0][0], "Köln");
  assert.equal(searchCities(rows, "", 8).length, 0);
});
