(function () {
  function center(scroller) {
    if (scroller && scroller.scrollWidth > scroller.clientWidth) scroller.scrollLeft = (scroller.scrollWidth - scroller.clientWidth) / 2;
  }
  function bindMap(container) {
    var block = container.closest(".map-block");
    var status = block && block.querySelector("[data-map-status]");
    container.querySelectorAll("a[data-map-name]").forEach(function (link) {
      function show() { if (status) status.textContent = link.dataset.mapName + " namaz vakitleri"; }
      function clear() { if (status) status.textContent = ""; }
      link.addEventListener("pointerenter", show); link.addEventListener("pointerleave", clear);
      link.addEventListener("focus", show); link.addEventListener("blur", clear);
    });
    center(container.closest(".map-scroll"));
  }
  function load(container) {
    if (container.dataset.loaded) return;
    container.dataset.loaded = "1";
    fetch(container.dataset.mapSrc).then(function (response) {
      if (!response.ok) throw new Error(response.status);
      return response.text();
    }).then(function (svg) { container.innerHTML = svg; container.removeAttribute("aria-busy"); bindMap(container); })
      .catch(function () { container.innerHTML = "<p>Harita yüklenemedi.</p>"; });
  }
  document.querySelectorAll("[data-map-src]").forEach(function (container) {
    if ("IntersectionObserver" in window) {
      var observer = new IntersectionObserver(function (entries) {
        if (entries.some(function (entry) { return entry.isIntersecting; })) { observer.disconnect(); load(container); }
      }, { rootMargin: "200px" });
      observer.observe(container);
    } else load(container);
  });
  document.querySelectorAll(".map-canvas:not([data-map-src])").forEach(bindMap);
  document.querySelectorAll("[data-map-tabs]").forEach(function (tabs) {
    tabs.classList.add("maps-ready");
    var buttons = Array.from(tabs.querySelectorAll('[role="tab"]'));
    function select(button, immediate) {
      buttons.forEach(function (item) {
        var active = item === button;
        item.setAttribute("aria-selected", String(active)); item.tabIndex = active ? 0 : -1;
        var panel = document.getElementById(item.getAttribute("aria-controls")); panel.hidden = !active;
        if (active && immediate) { var map = panel.querySelector("[data-map-src]"); if (map) load(map); }
      });
    }
    buttons.forEach(function (button, index) {
      button.addEventListener("click", function () { select(button, true); });
      button.addEventListener("keydown", function (event) {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault(); var step = event.key === "ArrowRight" ? 1 : -1;
        var next = buttons[(index + step + buttons.length) % buttons.length]; select(next, true); next.focus();
      });
    });
    select(buttons[0], false);
  });
})();
