/* hakyol.app — today's prayer times widget (client-side, static site).
 * Uses adhan.js (bundled). Geolocation -> nearest city (BigDataCloud, no key)
 * -> prayer times matching the Hakyol app's method (Turkey inside TR, else MWL).
 * Times are ESTIMATES — a disclaimer is always shown.
 */
(function () {
  var L = document.documentElement.getAttribute("lang") || "tr";
  var RTL = { ar: 1, fa: 1, ur: 1 };

  var I18N = {
    tr: { h: "Bugünün Namaz Vakitleri", near: "En yakın", loading: "Vakitler hesaplanıyor…",
      perm: "Vakitleri göstermek için konum iznine ihtiyacımız var.", retry: "Konumu kullan",
      err: "Konum alınamadı. Kesin vakitler için uygulamayı kullanın.",
      names: ["İmsak", "Güneş", "Öğle", "İkindi", "Akşam", "Yatsı"],
      disc: "Bu vakitler yaklaşık değerlerdir; bölgenizin resmî vakitleriyle birkaç dakika farklılık gösterebilir. Hakyol uygulaması mümkün olduğunda resmî vakitleri kullanır ve size ezan sesi veya bildirimle hatırlatır." },
    en: { h: "Today's Prayer Times", near: "Nearest", loading: "Calculating times…",
      perm: "We need your location to show prayer times.", retry: "Use my location",
      err: "Couldn't get your location. Use the app for accurate times.",
      names: ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"],
      disc: "These times are approximate and may differ from your area's official times by a few minutes. The Hakyol app uses official times where available and reminds you with the adhan or a notification." },
    ar: { h: "مواقيت الصلاة اليوم", near: "الأقرب", loading: "جارٍ حساب المواقيت…",
      perm: "نحتاج إلى موقعك لعرض مواقيت الصلاة.", retry: "استخدم موقعي",
      err: "تعذّر تحديد موقعك. استخدم التطبيق للحصول على مواقيت دقيقة.",
      names: ["الفجر", "الشروق", "الظهر", "العصر", "المغرب", "العشاء"],
      disc: "هذه المواقيت تقريبية وقد تختلف عن المواقيت الرسمية في منطقتك بدقائق. يستخدم تطبيق حاكيول المواقيت الرسمية عند توفرها ويذكّرك بالأذان أو بإشعار." },
    fa: { h: "اوقات نماز امروز", near: "نزدیک‌ترین", loading: "در حال محاسبه اوقات…",
      perm: "برای نمایش اوقات نماز به موقعیت شما نیاز داریم.", retry: "استفاده از موقعیت من",
      err: "موقعیت شما دریافت نشد. برای اوقات دقیق از برنامه استفاده کنید.",
      names: ["اذان صبح", "طلوع", "ظهر", "عصر", "مغرب", "عشا"],
      disc: "این اوقات تقریبی است و ممکن است چند دقیقه با اوقات رسمی منطقه شما تفاوت داشته باشد. برنامه حاکیول در صورت امکان از اوقات رسمی استفاده می‌کند و با اذان یا اعلان به شما یادآوری می‌کند." },
    ur: { h: "آج کی نماز کے اوقات", near: "قریب ترین", loading: "اوقات کا حساب لگایا جا رہا ہے…",
      perm: "نماز کے اوقات دکھانے کے لیے ہمیں آپ کے مقام کی ضرورت ہے۔", retry: "میرا مقام استعمال کریں",
      err: "آپ کا مقام حاصل نہیں ہو سکا۔ درست اوقات کے لیے ایپ استعمال کریں۔",
      names: ["سحری", "طلوعِ آفتاب", "ظہر", "عصر", "مغرب", "عشا"],
      disc: "یہ اوقات تخمینی ہیں اور آپ کے علاقے کے سرکاری اوقات سے چند منٹ مختلف ہو سکتے ہیں۔ حاکیول ایپ دستیاب ہونے پر سرکاری اوقات استعمال کرتی ہے اور اذان یا نوٹیفکیشن سے یاد دہانی کراتی ہے۔" },
    bn: { h: "আজকের নামাজের সময়", near: "নিকটতম", loading: "সময় গণনা করা হচ্ছে…",
      perm: "নামাজের সময় দেখাতে আপনার অবস্থান প্রয়োজন।", retry: "আমার অবস্থান ব্যবহার করুন",
      err: "অবস্থান পাওয়া যায়নি। সঠিক সময়ের জন্য অ্যাপ ব্যবহার করুন।",
      names: ["ফজর", "সূর্যোদয়", "যোহর", "আসর", "মাগরিব", "ইশা"],
      disc: "এই সময়গুলো আনুমানিক এবং আপনার এলাকার সরকারি সময়ের সাথে কয়েক মিনিট পার্থক্য হতে পারে। Hakyol অ্যাপ সম্ভব হলে সরকারি সময় ব্যবহার করে এবং আজান বা নোটিফিকেশন দিয়ে মনে করিয়ে দেয়।" },
    id: { h: "Jadwal Salat Hari Ini", near: "Terdekat", loading: "Menghitung waktu…",
      perm: "Kami perlu lokasi Anda untuk menampilkan jadwal salat.", retry: "Gunakan lokasi saya",
      err: "Tidak bisa mendapatkan lokasi. Gunakan aplikasi untuk waktu yang akurat.",
      names: ["Subuh", "Terbit", "Zuhur", "Asar", "Magrib", "Isya"],
      disc: "Waktu ini adalah perkiraan dan dapat berbeda beberapa menit dari waktu resmi daerah Anda. Aplikasi Hakyol memakai waktu resmi jika tersedia dan mengingatkan Anda dengan adzan atau notifikasi." }
  };
  var t = I18N[L] || I18N.tr;

  var el = document.getElementById("prayer-widget");
  if (!el) return;

  function h(html) { el.innerHTML = html; }
  function esc(s) { return String(s).replace(/[<>&"]/g, function (c) { return { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]; }); }

  function askPermission() {
    h('<p class="pw-msg">' + esc(t.perm) + "</p>" +
      '<button class="pw-btn" id="pw-go">' + esc(t.retry) + "</button>");
    document.getElementById("pw-go").addEventListener("click", locate);
  }

  function locate() {
    h('<p class="pw-msg">' + esc(t.loading) + "</p>");
    if (!navigator.geolocation) { h('<p class="pw-msg">' + esc(t.err) + "</p>"); return; }
    navigator.geolocation.getCurrentPosition(onPos, onErr,
      { enableHighAccuracy: false, timeout: 9000, maximumAge: 3600000 });
  }

  function onErr() { askPermission(); }

  function inTurkey(lat, lon) {
    return lat >= 35.8 && lat <= 42.3 && lon >= 25.5 && lon <= 44.9;
  }

  function onPos(pos) {
    var lat = pos.coords.latitude, lon = pos.coords.longitude;
    var A = window.adhan;
    var coords = new A.Coordinates(lat, lon);
    var params = inTurkey(lat, lon) ? A.CalculationMethod.Turkey() : A.CalculationMethod.MuslimWorldLeague();
    var pt = new A.PrayerTimes(coords, new Date(), params);
    var fmt = function (d) { return d.toLocaleTimeString(L === "tr" ? "tr-TR" : L, { hour: "2-digit", minute: "2-digit" }); };
    var times = [pt.fajr, pt.sunrise, pt.dhuhr, pt.asr, pt.maghrib, pt.isha];

    render("…", times, fmt);

    fetch("https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=" + lat +
      "&longitude=" + lon + "&localityLanguage=" + (L === "tr" ? "tr" : L))
      .then(function (r) { return r.json(); })
      .then(function (g) {
        var city = g.city || g.locality || g.principalSubdivision || g.countryName || "";
        render(city, times, fmt);
      })
      .catch(function () { render("", times, fmt); });
  }

  function render(city, times, fmt) {
    var rows = t.names.map(function (n, i) {
      return '<div class="pw-row"><span class="pw-name">' + esc(n) +
        '</span><span class="pw-time">' + esc(fmt(times[i])) + "</span></div>";
    }).join("");
    var cityLine = city ? '<p class="pw-city">' + esc(t.near) + ": <strong>" + esc(city) + "</strong></p>" : "";
    h('<h3 class="pw-h">' + esc(t.h) + "</h3>" + cityLine +
      '<div class="pw-grid">' + rows + "</div>" +
      '<p class="pw-disc">' + esc(t.disc) + "</p>");
  }

  askPermission();
})();
