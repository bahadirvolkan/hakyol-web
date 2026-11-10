/* hakyol.app — açılışta alttan çıkan "uygulamayı indir" kartı.
 * Tam ekran değil (Google'ın mobil "intrusive interstitial" cezasına girmemek için alt kart),
 * platforma göre tek mağaza düğmesi (iOS → App Store, Android → Google Play, masaüstü → ikisi).
 * Kapatılınca 24 saat tekrar çıkmaz. Ana sayfa (7 dil) ve /namaz-vakitleri/ sayfalarında yüklenir.
 */
(function () {
  var KEY = "hakyol_popup_until";
  var HIDE_MS = 24 * 3600000;
  try {
    if (Number(localStorage.getItem(KEY)) > Date.now()) return;
  } catch (e) {}

  var L = document.documentElement.getAttribute("lang") || "tr";
  var T = {
    tr: { h: "Hakyol'u ücretsiz indirin", p: "Vakit girince ezan sesiyle haber verir. Kıble, Kur'an ve zikirmatik içinde. Üyelik yok, abonelik yok.", as: "App Store'dan indir", gp: "Google Play'den indir", x: "Şimdi değil" },
    en: { h: "Get Hakyol free", p: "Adhan alerts when prayer time comes, plus qibla, the Qur'an and dhikr. No sign-up, no subscription.", as: "Download on the App Store", gp: "Get it on Google Play", x: "Not now" },
    id: { h: "Unduh Hakyol gratis", p: "Notifikasi azan saat waktu salat tiba, plus kiblat, Al-Qur'an, dan dzikir. Tanpa daftar, tanpa langganan.", as: "Unduh di App Store", gp: "Dapatkan di Google Play", x: "Nanti saja" },
    bn: { h: "বিনামূল্যে Hakyol ডাউনলোড করুন", p: "নামাজের সময় হলে আজানের বিজ্ঞপ্তি, সাথে কিবলা, কুরআন ও জিকির। কোনো নিবন্ধন বা সাবস্ক্রিপশন নেই।", as: "App Store থেকে ডাউনলোড", gp: "Google Play থেকে ডাউনলোড", x: "এখন নয়" },
    ar: { h: "حمّل حاكيول مجانًا", p: "تنبيه بالأذان عند دخول وقت الصلاة، مع القبلة والقرآن والذكر. بلا تسجيل وبلا اشتراك.", as: "حمّله من App Store", gp: "احصل عليه من Google Play", x: "ليس الآن" },
    fa: { h: "حاکیول را رایگان دریافت کنید", p: "اعلان اذان هنگام وقت نماز، همراه با قبله، قرآن و ذکر. بدون ثبت‌نام، بدون اشتراک.", as: "دریافت از App Store", gp: "دریافت از Google Play", x: "بعداً" },
    ur: { h: "حاکیول مفت ڈاؤن لوڈ کریں", p: "نماز کا وقت ہونے پر اذان کی اطلاع، ساتھ قبلہ، قرآن اور ذکر۔ نہ رجسٹریشن، نہ سبسکرپشن۔", as: "App Store سے ڈاؤن لوڈ کریں", gp: "Google Play سے حاصل کریں", x: "ابھی نہیں" },
  }[L] || null;
  if (!T) return;

  var ua = navigator.userAgent;
  var ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var android = /Android/.test(ua);
  var campaign = "popup_" + (location.pathname.indexOf("/namaz-vakitleri") === 0 ? "city" : L);
  var appStore = "https://apps.apple.com/app/hakyol/id6794740149?ct=" + campaign + "&mt=8";
  var play = "https://play.google.com/store/apps/details?id=com.bahadir.hakyol&referrer=utm_source%3Dhakyol.app%26utm_medium%3Dweb%26utm_campaign%3D" + campaign;

  var css =
    ".hk-pop{position:fixed;left:12px;right:12px;bottom:12px;z-index:50;max-width:440px;margin:0 auto;" +
    "background:var(--card,#141E32);border:1px solid var(--gold,#D4AF37);border-radius:20px;padding:18px 18px 14px;" +
    "box-shadow:0 18px 50px rgba(0,0,0,.55);color:var(--text,#F5F3EC);font-family:var(--sans,sans-serif);" +
    "transform:translateY(130%);transition:transform .35s ease}" +
    ".hk-pop.in{transform:none}" +
    ".hk-pop .hk-top{display:flex;gap:12px;align-items:center;margin-bottom:8px}" +
    ".hk-pop img{width:48px;height:48px;border-radius:12px;flex-shrink:0}" +
    ".hk-pop h3{margin:0;font-size:17px;line-height:1.3}" +
    ".hk-pop p{margin:0 0 14px;font-size:14px;line-height:1.5;color:var(--text-soft,#C9CEDA)}" +
    ".hk-pop .hk-btn{display:block;text-align:center;background:var(--gold,#D4AF37);color:#241a04;font-weight:800;" +
    "font-size:15px;border-radius:12px;padding:12px;margin-bottom:8px;text-decoration:none}" +
    ".hk-pop .hk-x{display:block;width:100%;background:none;border:0;color:var(--text-faint,#7C8AA3);font-size:13px;" +
    "padding:6px;cursor:pointer;font-family:inherit}";

  function btn(href, label) {
    return '<a class="hk-btn" href="' + href + '" rel="noopener">' + label + "</a>";
  }

  function show() {
    var st = document.createElement("style");
    st.textContent = css;
    document.head.appendChild(st);
    var box = document.createElement("div");
    box.className = "hk-pop";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", T.h);
    box.innerHTML =
      '<div class="hk-top"><img src="/icon.png" alt=""><h3>' + T.h + "</h3></div>" +
      "<p>" + T.p + "</p>" +
      (android ? "" : btn(appStore, T.as)) +
      (ios ? "" : btn(play, T.gp)) +
      '<button class="hk-x" type="button">' + T.x + "</button>";
    document.body.appendChild(box);
    requestAnimationFrame(function () { box.classList.add("in"); });
    if (window.hakyolTrack) window.hakyolTrack("popup_shown", { platform: ios ? "ios" : android ? "android" : "desktop" });
    function hide() {
      try { localStorage.setItem(KEY, String(Date.now() + HIDE_MS)); } catch (e) {}
      box.classList.remove("in");
      setTimeout(function () { box.remove(); }, 400);
    }
    box.querySelector(".hk-x").addEventListener("click", hide);
    [].forEach.call(box.querySelectorAll(".hk-btn"), function (a) { a.addEventListener("click", hide); });
  }

  setTimeout(show, 1500);
})();
