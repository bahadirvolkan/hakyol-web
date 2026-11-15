/* hakyol.app — şehir sayfasını telefonun ana ekranına ekleme kartı (PWA kısayolu).
 * Her il/ilçe sayfasının kendi manifest'i var (start_url = o sayfa), ana ekrandaki simge doğrudan
 * o şehrin vakitlerini açar. Instagram/Facebook içi tarayıcıda "ana ekrana ekle" yoktur: önce
 * gerçek tarayıcıya geçirilir (Android: Chrome intent bağlantısı; iOS: x-safari-https, olmazsa tarif).
 * Android Chrome'da beforeinstallprompt ile tek dokunuş; iOS Safari'de Paylaş > Ana Ekrana Ekle tarifi.
 * Masaüstünde ve ana ekrandan açılmışken gösterilmez. Kapatılırsa 30 gün çıkmaz.
 */
(function () {
  var box = document.querySelector("[data-a2hs]");
  if (!box) return;
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js", { scope: "/namaz-vakitleri/" }).catch(function () {});
  }
  var standalone = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  if (standalone) return;
  var KEY = "hakyol_a2hs_until";
  try {
    if (Number(localStorage.getItem(KEY)) > Date.now()) return;
  } catch (e) {}
  var ua = navigator.userAgent;
  var ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var android = /Android/.test(ua);
  if (!ios && !android) return;
  var inApp = /Instagram|FBAN|FBAV|FB_IAB|FBIOS|TikTok|musical_ly|Line\//.test(ua);
  var place = box.getAttribute("data-place");
  var deferred = null;

  function track(step) {
    if (window.hakyolTrack) window.hakyolTrack("a2hs", { step: step, platform: ios ? "ios" : "android", in_app: inApp });
  }
  function render(body, button) {
    box.innerHTML =
      '<button class="a2hs-x" type="button" aria-label="Kapat">×</button>' +
      "<strong>" + place + " vakitleri ana ekranınızda</strong>" +
      "<p>Telefonunuza uygulama gibi bir simge eklenir; tek dokunuşla bugünün vakitleri açılır.</p>" +
      (button || "") + (body ? '<p class="a2hs-how">' + body + "</p>" : "");
    box.hidden = false;
    box.querySelector(".a2hs-x").addEventListener("click", function () {
      try { localStorage.setItem(KEY, String(Date.now() + 30 * 86400000)); } catch (e) {}
      box.hidden = true;
      track("dismiss");
    });
    var b = box.querySelector(".a2hs-btn");
    if (b) b.addEventListener("click", function () { track("click"); });
  }

  var here = location.href.replace(/^https?:\/\//, "");
  if (inApp && android) {
    render("Açılan Chrome'da sağ üstteki ⋮ menüsünden <b>Ana ekrana ekle</b>yi seçin.",
      '<a class="a2hs-btn" href="intent://' + here + "#Intent;scheme=https;package=com.android.chrome;end\">Chrome'da aç</a>");
  } else if (inApp) {
    render("Açılmazsa sağ üstteki <b>•••</b> simgesine dokunup <b>tarayıcıda aç</b>ın. Safari'de <b>Paylaş</b> simgesine (kare içinde yukarı ok) dokunup <b>Ana Ekrana Ekle</b>yi seçin.",
      '<a class="a2hs-btn" href="x-safari-https://' + here + "\">Safari'de aç</a>");
  } else if (ios) {
    render("<b>Paylaş</b> simgesine (kare içinde yukarı ok) dokunun, listeden <b>Ana Ekrana Ekle</b>yi seçin. Paylaş simgesini görmüyorsanız önce <b>•••</b> menüsünü açın.");
  } else {
    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      deferred = e;
      render("", '<button class="a2hs-btn" type="button">Ana ekrana ekle</button>');
      box.querySelector(".a2hs-btn").addEventListener("click", function () {
        deferred.prompt();
        deferred.userChoice.then(function (c) { track(c.outcome); if (c.outcome === "accepted") box.hidden = true; });
      });
    });
    setTimeout(function () {
      if (!deferred) render("Tarayıcınızın menüsünden (⋮) <b>Ana ekrana ekle</b>yi seçin.");
    }, 2500);
  }
  window.addEventListener("appinstalled", function () { track("installed"); });
  track("shown");
})();
