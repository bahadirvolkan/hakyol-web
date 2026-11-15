(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.HakyolCitySearch = api; api.init(); }
})(typeof window !== "undefined" ? window : globalThis, function () {
  function normalizeSearch(value) {
    return String(value || "").normalize("NFD")
      .replace(/[\u0300-\u036f\u0610-\u061a\u0640\u064b-\u065f\u0670\u06d6-\u06ed]/g, "")
      .replace(/ß/g, "ss").replace(/ı/g, "i").replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/ة/g, "ه").toLowerCase()
      .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
  }

  function rank(key, query) {
    if (key.indexOf(query) === 0) return 0;
    if ((" " + key).indexOf(" " + query) !== -1) return 1;
    if (key.indexOf(query) !== -1) return 2;
    return 9;
  }

  function searchCities(index, value, limit) {
    var query = normalizeSearch(value);
    if (!query) return [];
    return index.map(function (row, order) { return { row: row, order: order, rank: rank(row[3], query) }; })
      .filter(function (item) { return item.rank < 9; })
      .sort(function (a, b) {
        var aDepth = a.row[2].split("/").filter(Boolean).length;
        var bDepth = b.row[2].split("/").filter(Boolean).length;
        return a.rank - b.rank || aDepth - bDepth || a.order - b.order;
      })
      .slice(0, limit || 8).map(function (item) { return item.row; });
  }

  function init() {
    document.querySelectorAll("[data-city-search]").forEach(function (host, hostNo) {
      var input = document.createElement("input"), list = document.createElement("div");
      var index, loading, results = [], active = -1, listId = "city-search-list-" + hostNo;
      input.type = "search"; input.placeholder = host.dataset.placeholder || "";
      input.setAttribute("role", "combobox"); input.setAttribute("aria-autocomplete", "list");
      input.setAttribute("aria-controls", listId); input.setAttribute("aria-expanded", "false");
      list.id = listId; list.className = "city-search-results"; list.setAttribute("role", "listbox");
      host.classList.add("city-search"); host.appendChild(input); host.appendChild(list);
      function load() { return loading || (loading = fetch(host.dataset.index).then(function (r) { if (!r.ok) throw Error(r.status); return r.json(); }).then(function (data) { index = data; return data; })); }
      function choose(row) { document.dispatchEvent(new CustomEvent("city-search-select", { detail: { q_len: input.value.length, result_url: row[2] } })); location.href = row[2]; }
      function render() {
        if (!index) return;
        results = searchCities(index, input.value, 8); active = results.length ? 0 : -1;
        list.innerHTML = results.map(function (row, i) { return '<a role="option" id="' + listId + '-' + i + '" href="' + row[2] + '" data-i="' + i + '">' + row[0] + ' <span>· ' + row[1] + '</span></a>'; }).join("");
        if (!results.length && input.value.trim()) list.textContent = host.dataset.noResults || "Sonuç yok";
        input.setAttribute("aria-expanded", results.length ? "true" : "false"); updateActive();
      }
      function updateActive() { [].forEach.call(list.querySelectorAll("[role=option]"), function (el, i) { el.setAttribute("aria-selected", i === active ? "true" : "false"); }); if (active >= 0) input.setAttribute("aria-activedescendant", listId + "-" + active); else input.removeAttribute("aria-activedescendant"); }
      input.addEventListener("focus", function () { load().then(render); });
      input.addEventListener("input", function () { load().then(render); });
      input.addEventListener("keydown", function (event) {
        if (event.key === "ArrowDown" && results.length) { event.preventDefault(); active = (active + 1) % results.length; updateActive(); }
        else if (event.key === "ArrowUp" && results.length) { event.preventDefault(); active = (active + results.length - 1) % results.length; updateActive(); }
        else if (event.key === "Enter" && results.length && (active >= 0 || results.length === 1)) { event.preventDefault(); choose(results[active >= 0 ? active : 0]); }
        else if (event.key === "Escape") { results = []; active = -1; list.innerHTML = ""; input.setAttribute("aria-expanded", "false"); updateActive(); }
      });
      list.addEventListener("click", function (event) { var a = event.target.closest("a[data-i]"); if (!a) return; event.preventDefault(); choose(results[Number(a.dataset.i)]); });
    });
  }
  return { normalizeSearch: normalizeSearch, searchCities: searchCities, init: init };
});
