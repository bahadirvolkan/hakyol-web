const test = require("node:test");
const assert = require("node:assert/strict");
const {
  qiblaBearing,
  haversineKm,
  nextFriday,
  zonedNowParts,
  nextPrayer,
  validateApiPayload,
} = require("../lib/features");

test("kıble açısı kuzeyden saat yönünde hesaplanır", () => {
  assert.ok(Math.abs(qiblaBearing(41.0082, 28.9784) - 151.6) <= 0.5);
  assert.ok(Math.abs(qiblaBearing(52.52, 13.405) - 136.7) <= 0.5);
  assert.ok(Math.abs(qiblaBearing(50.9375, 6.9603) - 126.7) <= 0.5);
});

test("İstanbul Kâbe büyük daire uzaklığı yaklaşık 2400 km'dir", () => {
  assert.ok(Math.abs(haversineKm(41.0082, 28.9784, 21.422487, 39.826206) - 2400) < 40);
});

test("cuma günü bugün, diğer günler gelecek cuma seçilir", () => {
  assert.equal(nextFriday("2026-11-20"), "2026-11-20");
  assert.equal(nextFriday("2026-11-19"), "2026-11-20");
  assert.equal(nextFriday("2026-11-21"), "2026-11-27");
});

test("saat dilimi parçaları ziyaretçinin saat diliminden bağımsızdır", () => {
  const now = new Date("2026-11-19T21:30:00Z");
  assert.deepEqual(zonedNowParts(now, "Europe/Istanbul"), { date: "2026-11-20", minutes: 30 });
  assert.deepEqual(zonedNowParts(now, "Europe/Berlin"), { date: "2026-11-19", minutes: 1350 });
});

test("sonraki vakit ve kalan dakika seçilir", () => {
  const row = ["2026-11-20", "06:10", "07:40", "12:54", "15:25", "17:49", "19:13"];
  const tomorrow = ["2026-11-21", "06:11", "07:41", "12:54", "15:24", "17:48", "19:12"];
  assert.deepEqual(nextPrayer(row, 12 * 60), { index: 2, minutes: 54 });
  assert.deepEqual(nextPrayer(row, 20 * 60, tomorrow), { index: 0, minutes: 611 });
  assert.equal(nextPrayer(row, 20 * 60), null);
});

test("API şeması yalnız geçerli küçük payload'ı kabul eder", () => {
  const valid = { ad: "Kadıköy", url: "https://hakyol.app/namaz-vakitleri/istanbul/kadikoy/", tz: "Europe/Istanbul", gunler: [["2026-11-20", "06:10", "07:40", "12:54", "15:25", "17:49", "19:13"]] };
  assert.equal(validateApiPayload(valid), true);
  assert.equal(validateApiPayload({ ...valid, url: "/relative" }), false);
  assert.equal(validateApiPayload({ ...valid, gunler: [["2026-11-20", "06:10"]] }), false);
});
