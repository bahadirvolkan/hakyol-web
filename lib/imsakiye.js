const adhan = require("../js/adhan.min.js");

const DAY = 86400000;
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (ymd, n) => iso(new Date(new Date(`${ymd}T12:00:00Z`).getTime() + n * DAY));
const diffDays = (a, b) => Math.round((new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`)) / DAY);
const hijriParts = (date) => Object.fromEntries(new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC" }).formatToParts(date).map((x) => [x.type, x.value]));

function ramadanDates(hijriYear) {
  const approx = 2027 + (hijriYear - 1448) * 354 / 365.2425;
  const from = new Date(`${Math.floor(approx) - 1}-11-01T12:00:00Z`);
  let start, eid;
  for (let i = 0; i < 500 && (!start || !eid); i++) {
    const d = new Date(from.getTime() + i * DAY), p = hijriParts(d);
    if (+p.year === hijriYear && +p.day === 1 && +p.month === 9) start = iso(d);
    if (+p.year === hijriYear && +p.day === 1 && +p.month === 10) eid = iso(d);
  }
  if (!start || !eid) throw new Error(`Umm al-Qura tarihi bulunamadı: ${hijriYear}`);
  return { start, eid, days: diffDays(start, eid) };
}

function ramadanStatus(today, baseYear = 1448) {
  let year = baseYear, dates = ramadanDates(year);
  while (today >= dates.eid) { year++; dates = ramadanDates(year); }
  if (today < dates.start) return { phase: "before", value: diffDays(today, dates.start), hijriYear: year };
  return { phase: "during", value: diffDays(dates.start, today) + 1, hijriYear: year };
}

function formatTime(date, tz) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
}

function turkeyTimes(lat, lng, tz, ymd) {
  const factory = adhan.CalculationMethod.Turkey || adhan.CalculationMethod.MuslimWorldLeague;
  const p = factory(); p.rounding = adhan.Rounding.Nearest;
  const t = new adhan.PrayerTimes(new adhan.Coordinates(lat, lng), new Date(`${ymd}T12:00:00Z`), p);
  return Object.fromEntries([["imsak", "fajr"], ["sunrise", "sunrise"], ["dhuhr", "dhuhr"], ["asr", "asr"], ["maghrib", "maghrib"], ["isha", "isha"]].map(([out, key]) => [out, formatTime(t[key], tz)]));
}

function shift(time, delta = 0) { const [h, m] = time.split(":").map(Number), n = (h * 60 + m + delta + 1440) % 1440; return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`; }

function buildTurkeyRows({ id, lat, lng, tz = "Europe/Istanbul", dates, vakitler, adjustments = {} }) {
  const byDate = new Map((vakitler.ilce?.[id] || []).map((r) => [r[0], r]));
  return dates.map((ymd, i) => {
    const r = byDate.get(ymd);
    if (r) return { ymd, imsak: r[1], sunrise: r[2], dhuhr: r[3], asr: r[4], maghrib: r[5], isha: r[6], hijri: r[8], source: "official" };
    const calculated = turkeyTimes(lat, lng, tz, ymd);
    for (const [key, delta] of Object.entries(adjustments)) calculated[key] = shift(calculated[key], delta);
    return { ymd, ...calculated, hijri: `${i + 1} Ramazan`, source: "calculated" };
  });
}

const DIGITS = { bn: "০১২৩৪৫৬৭৮৯", fa: "۰۱۲۳۴۵۶۷۸۹", ar: "٠١٢٣٤٥٦٧٨٩" };
function digits(value, lang) { return DIGITS[lang] ? String(value).replace(/\d/g, (n) => DIGITS[lang][n]) : String(value); }

module.exports = { ramadanDates, ramadanStatus, buildTurkeyRows, turkeyTimes, digits, addDays, diffDays, shift };
