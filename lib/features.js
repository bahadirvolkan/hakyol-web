const KAABA = { lat: 21.422487, lng: 39.826206 };
const rad = (n) => n * Math.PI / 180;

function qiblaBearing(lat, lng) {
  const p1 = rad(lat), p2 = rad(KAABA.lat), dl = rad(KAABA.lng - lng);
  return (Math.atan2(Math.sin(dl), Math.cos(p1) * Math.tan(p2) - Math.sin(p1) * Math.cos(dl)) * 180 / Math.PI + 360) % 360;
}

function haversineKm(lat1, lng1, lat2 = KAABA.lat, lng2 = KAABA.lng) {
  const dp = rad(lat2 - lat1), dl = rad(lng2 - lng1);
  const a = Math.sin(dp / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dl / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nextFriday(ymd) {
  const d = new Date(`${ymd}T12:00:00Z`), add = (5 - d.getUTCDay() + 7) % 7;
  d.setUTCDate(d.getUTCDate() + add);
  return d.toISOString().slice(0, 10);
}

function zonedNowParts(date, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

function nextPrayer(row, nowMinutes, tomorrow) {
  for (let i = 1; i < 7; i++) {
    const [h, m] = row[i].split(":").map(Number), minutes = h * 60 + m;
    if (minutes > nowMinutes) return { index: i - 1, minutes: minutes - nowMinutes };
  }
  if (tomorrow) {
    const [h, m] = tomorrow[1].split(":").map(Number);
    return { index: 0, minutes: 1440 - nowMinutes + h * 60 + m };
  }
  return null;
}

function validateApiPayload(x) {
  return !!x && typeof x.ad === "string" && /^https:\/\/hakyol\.app\//.test(x.url) && typeof x.tz === "string" && Array.isArray(x.gunler) && x.gunler.every((r) => Array.isArray(r) && r.length === 7 && /^\d{4}-\d{2}-\d{2}$/.test(r[0]) && r.slice(1).every((v) => /^\d{2}:\d{2}$/.test(v)));
}

function directionName(deg) {
  return ["kuzey", "kuzey-doğu", "doğu", "güney-doğu", "güney", "güney-batı", "batı", "kuzey-batı"][Math.round(deg / 45) % 8];
}

module.exports = { KAABA, qiblaBearing, haversineKm, nextFriday, zonedNowParts, nextPrayer, validateApiPayload, directionName };
