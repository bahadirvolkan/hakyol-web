const test = require("node:test");
const assert = require("node:assert/strict");

const { selectIds, normalizeRows } = require("../scripts/fetch-vakitler");

const tr = [{ ilceler: [{ ilceId: "10" }, { ilceId: "11" }] }];
const world = { countries: [{ cities: [{ ilceId: "20" }, { ilceId: "21" }] }] };

test("selectIds supports all, world-only and missing-only selection", () => {
  assert.deepEqual(selectIds(tr, world, {}), ["10", "11", "20", "21"]);
  assert.deepEqual(selectIds(tr, world, { onlyWorld: true }), ["20", "21"]);
  assert.deepEqual(selectIds(tr, world, { onlyWorld: true, onlyMissing: true, covered: new Set(["20"]) }), ["21"]);
});

test("normalizeRows rejects an HTTP-success payload that does not cover today", () => {
  const stale = [{ MiladiTarihKisa: "14.11.2026", Imsak: "06:00", Gunes: "07:00", Ogle: "12:00", Ikindi: "15:00", Aksam: "18:00", Yatsi: "19:00", KibleSaati: "11:00", HicriTarihUzun: "x" }];
  assert.throws(() => normalizeRows(stale, "2026-11-15"), /bugünü kapsamıyor/);
  assert.throws(() => normalizeRows([], "2026-11-15"), /bugünü kapsamıyor/);
});
