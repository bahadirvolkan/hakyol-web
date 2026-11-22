const test = require("node:test");
const assert = require("node:assert/strict");
const { WIDGET_LANGS, localizeDigits } = require("../widget.js");

test("widget Endonezce Urduca ve Bengalce vakit adlarını sunar", () => {
  assert.deepEqual(WIDGET_LANGS.id.p, ["Subuh", "Terbit", "Dzuhur", "Ashar", "Maghrib", "Isya"]);
  assert.deepEqual(WIDGET_LANGS.ur.p, ["فجر", "طلوع آفتاب", "ظہر", "عصر", "مغرب", "عشاء"]);
  assert.deepEqual(WIDGET_LANGS.bn.p, ["ফজর", "সূর্যোদয়", "যোহর", "আসর", "মাগরিব", "এশা"]);
  assert.equal(WIDGET_LANGS.ur.dir, "rtl");
});

test("widget rakamları sayfa dil kuralıyla aynı yerelleştirir", () => {
  assert.equal(localizeDigits("06:26 · 26", "bn"), "০৬:২৬ · ২৬");
  for (const lang of ["tr", "de", "en", "nl", "id", "ur", "ar"]) assert.equal(localizeDigits("06:26", lang), "06:26");
  assert.equal(localizeDigits("06:26", "fa"), "۰۶:۲۶");
});
