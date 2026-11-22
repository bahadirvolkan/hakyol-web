const test = require("node:test");
const assert = require("node:assert/strict");

const { ramadanDates, ramadanStatus, buildTurkeyRows, digits } = require("../lib/imsakiye");

test("Umm al-Qura 1448 Ramazanı 8 Şubat'ta başlar ve 29 gündür", () => {
  const x = ramadanDates(1448);
  assert.deepEqual(x, { start: "2027-02-08", eid: "2027-03-09", days: 29 });
});

test("Ramazan durumu önce, içinde ve sonrasında sıradaki yılı gösterir", () => {
  assert.deepEqual(ramadanStatus("2027-02-01", 1448), { phase: "before", value: 7, hijriYear: 1448 });
  assert.deepEqual(ramadanStatus("2027-02-10", 1448), { phase: "during", value: 3, hijriYear: 1448 });
  assert.deepEqual(ramadanStatus("2027-03-10", 1448), { phase: "before", value: 324, hijriYear: 1449 });
});

test("Diyanet satırı kapsamdaysa gerçek satır ve dürüst kaynak etiketi seçilir", () => {
  const fixture = { ilce: { "1": [["2027-02-08", "06:01", "07:20", "13:00", "16:00", "18:30", "19:45", "", "1 Ramazan 1448"]] } };
  const rows = buildTurkeyRows({ id: "1", lat: 39.9, lng: 32.8, tz: "Europe/Istanbul", dates: ["2027-02-08"], vakitler: fixture });
  assert.equal(rows[0].imsak, "06:01");
  assert.equal(rows[0].source, "official");
  assert.equal(rows[0].hijri, "1 Ramazan 1448");
});

test("Kapsam dışı günde hesaplanır ve Diyanet verisi diye işaretlenmez", () => {
  const rows = buildTurkeyRows({ id: "1", lat: 39.9, lng: 32.8, tz: "Europe/Istanbul", dates: ["2027-02-08"], vakitler: { ilce: {} } });
  assert.match(rows[0].imsak, /^\d{2}:\d{2}$/);
  assert.equal(rows[0].source, "calculated");
});

test("Bengalce ve Farsça rakamlar yerelleştirilir", () => {
  assert.equal(digits("2027 14:48", "bn"), "২০২৭ ১৪:৪৮");
  assert.equal(digits("2027 14:48", "fa"), "۲۰۲۷ ۱۴:۴۸");
});
