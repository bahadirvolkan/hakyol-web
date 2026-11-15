(function () {
  document.querySelectorAll("[data-turkey-map]").forEach(function (map) {
    var label = map.querySelector("[data-map-label]");
    function show(link) { label.textContent = link.dataset.mapName + " namaz vakitleri"; }
    function clear(event) {
      if (!event.relatedTarget || !map.contains(event.relatedTarget)) label.textContent = "";
    }
    map.querySelectorAll("a[data-map-name]").forEach(function (link) {
      link.addEventListener("pointerenter", function () { show(link); });
      link.addEventListener("pointerleave", clear);
      link.addEventListener("focus", function () { show(link); });
      link.addEventListener("blur", clear);
    });
  });
})();
