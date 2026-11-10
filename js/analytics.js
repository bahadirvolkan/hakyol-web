/* hakyol.app — çerezsiz ziyaret ölçümü (PostHog AB, uygulamayla aynı "Hakyol" projesi, app="web").
 * Sayılan: sayfa görüntüleme, mağaza bağlantısı tıklaması (store_click), açılış kartı gösterimi (popup_shown).
 * persistence "memory": tarayıcıya çerez/kalıcı kimlik yazılmaz. Proje ayarında IP saklama kapalı
 * (anonymize_ips). Oturum kaydı ve otomatik tıklama yakalama kapalı. Gizlilik metni: privacy-policy.html.
 */
(function () {
  var KEY = "phc_mNKGoj5fDx6Fp9o5xuoTw2ziCFPjraxhojuEXwZvMHNy";
  var queue = [];

  function source() {
    var p = location.pathname;
    if (p.indexOf("/namaz-vakitleri") === 0) return p.split("/").filter(Boolean).length > 1 ? "city" : "city_hub";
    return "home";
  }

  window.hakyolTrack = function (event, props) {
    if (window.posthog && window.posthog.__loaded) window.posthog.capture(event, props);
    else queue.push([event, props]);
  };

  var s = document.createElement("script");
  s.async = true;
  s.crossOrigin = "anonymous";
  s.src = "https://eu-assets.i.posthog.com/static/array.js";
  s.onload = function () {
    window.posthog.init(KEY, {
      api_host: "https://eu.i.posthog.com",
      persistence: "memory",
      autocapture: false,
      capture_pageview: true,
      capture_pageleave: false,
      disable_session_recording: true,
      disable_surveys: true,
      advanced_disable_feature_flags: true,
      loaded: function (ph) {
        ph.register({ app: "web", page_type: source(), lang: document.documentElement.getAttribute("lang") });
        queue.forEach(function (e) { ph.capture(e[0], e[1]); });
        queue = [];
      },
    });
  };
  document.head.appendChild(s);

  // Mağaza tıklamaları: rozetler, şehir sayfası kutusu ve açılış kartı aynı dinleyiciden geçer.
  document.addEventListener("click", function (ev) {
    var a = ev.target.closest && ev.target.closest("a[href]");
    if (!a) return;
    var href = a.getAttribute("href");
    var store = href.indexOf("apps.apple.com") !== -1 ? "app_store" : href.indexOf("play.google.com") !== -1 ? "google_play" : null;
    if (!store) return;
    var place = a.closest(".hk-pop") ? "popup" : a.closest(".cta") ? "city_cta" : a.closest(".premium") ? "free_section" : "hero";
    window.hakyolTrack("store_click", { store: store, place: place });
  });
})();
