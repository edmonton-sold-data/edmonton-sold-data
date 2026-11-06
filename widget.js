/*!
 * Bridge Realty Group — Community Sold Stats Widget
 * Shows a neighbourhood's MLS(R) sales from the last 90 days:
 * number of sales, median sold price, median days on market.
 * Data: public Sold Explorer feed (REALTORS(R) Association of Edmonton MLS(R)).
 * Usage:
 *   <div class="brg-sold-widget" data-area="Garneau"></div>
 *   <script src="widget.js" async></script>
 * No dependencies. Safe to embed multiple times on one page.
 */
(function () {
  "use strict";

  var DATA_URL = "https://edmonton-sold-data.github.io/edmonton-sold-data/sold-explorer-data-v1.json";
  var LINK_URL = "https://bridgerealtygroup.ca/communities/sold-prices";
  var ACCENT = "#1a5632";
  var DAYS = 90;

  /* Area name aliases: display/legacy name -> name used in the MLS data. */
  var ALIASES = {
    "oliver": "Wîhkwêntôwin",
    "downtown oliver": "Wîhkwêntôwin"
  };

  var CSS = [
    ".brg-sw{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#fff;color:#1c2420;border:1px solid #dfe5e1;border-top:4px solid " + ACCENT + ";border-radius:10px;padding:16px 18px;max-width:420px;box-shadow:0 1px 4px rgba(0,0,0,.06)}",
    ".brg-sw *{box-sizing:border-box}",
    ".brg-sw h3{margin:0 0 2px;font-size:18px;line-height:1.25;font-weight:700;color:#1c2420}",
    ".brg-sw .brg-sw-sub{margin:0 0 12px;font-size:13px;color:#5b6a61}",
    ".brg-sw .brg-sw-stats{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 12px}",
    ".brg-sw .brg-sw-stat{flex:1 1 100px;background:#f4f7f5;border-radius:8px;padding:10px 12px;text-align:center}",
    ".brg-sw .brg-sw-num{display:block;font-size:21px;font-weight:700;color:" + ACCENT + ";line-height:1.15}",
    ".brg-sw .brg-sw-lab{display:block;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:#5b6a61;margin-top:3px}",
    ".brg-sw .brg-sw-msg{margin:0 0 12px;font-size:14px;line-height:1.45}",
    ".brg-sw .brg-sw-credit{margin:0 0 10px;font-size:11px;color:#7a877f;line-height:1.4}",
    ".brg-sw a.brg-sw-link{display:inline-block;font-size:14px;font-weight:600;color:" + ACCENT + ";text-decoration:none;border:1px solid " + ACCENT + ";border-radius:6px;padding:7px 12px}",
    ".brg-sw a.brg-sw-link:hover{background:" + ACCENT + ";color:#fff}",
    "@media (max-width:360px){.brg-sw .brg-sw-stats{flex-direction:column}.brg-sw .brg-sw-stat{flex:none}}"
  ].join("");

  function injectCss() {
    if (document.getElementById("brg-sw-css")) return;
    var s = document.createElement("style");
    s.id = "brg-sw-css";
    s.type = "text/css";
    s.appendChild(document.createTextNode(CSS));
    (document.head || document.documentElement).appendChild(s);
  }

  /* Lowercase, strip accents, drop "(...)" suffixes, tidy spaces. */
  function norm(name) {
    return String(name || "")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/\s*\([^)]*\)\s*$/, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function resolveName(area) {
    return ALIASES[norm(area)] || area;
  }

  function median(nums) {
    if (!nums.length) return null;
    var a = nums.slice().sort(function (x, y) { return x - y; });
    var m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
  }

  function money(n) {
    return "$" + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function esc(t) {
    return String(t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var dataPromise = null;
  function loadData() {
    if (!dataPromise) {
      dataPromise = fetch(DATA_URL, { mode: "cors" }).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      }).then(function (d) {
        return (d && d.sales) || [];
      });
    }
    return dataPromise;
  }

  function statsFor(sales, area) {
    var target = norm(resolveName(area));
    var rows = [], latest = null, i, s;
    for (i = 0; i < sales.length; i++) {
      s = sales[i];
      if (s.sold_date && (!latest || s.sold_date > latest)) latest = s.sold_date;
    }
    if (!latest) return { count: 0, price: null, dom: null };
    var cutoff = new Date(latest + "T00:00:00");
    cutoff.setDate(cutoff.getDate() - (DAYS - 1));
    var cutStr = cutoff.toISOString().slice(0, 10);
    var prices = [], doms = [];
    for (i = 0; i < sales.length; i++) {
      s = sales[i];
      if (norm(s.community) !== target) continue;
      if (!s.sold_date || s.sold_date < cutStr || s.sold_date > latest) continue;
      rows.push(s);
      if (typeof s.sold_price === "number" && s.sold_price > 0) prices.push(s.sold_price);
      if (typeof s.dom === "number" && s.dom >= 0) doms.push(s.dom);
    }
    return { count: rows.length, price: median(prices), dom: median(doms) };
  }

  function render(el, area) {
    var label = esc(area);
    el.innerHTML =
      '<div class="brg-sw" role="region" aria-label="Recent home sales in ' + label + '">' +
      "<h3>" + label + "</h3>" +
      '<p class="brg-sw-sub">Homes sold in the last 90 days</p>' +
      '<p class="brg-sw-msg">Loading the latest sales&hellip;</p>' +
      "</div>";
    var box = el.firstChild;
    loadData().then(function (sales) {
      var st = statsFor(sales, area);
      var mid;
      if (st.count > 0) {
        mid =
          '<div class="brg-sw-stats">' +
          '<div class="brg-sw-stat"><span class="brg-sw-num">' + st.count + '</span><span class="brg-sw-lab">Homes sold</span></div>' +
          '<div class="brg-sw-stat"><span class="brg-sw-num">' + (st.price ? money(st.price) : "&mdash;") + '</span><span class="brg-sw-lab">Median sold price</span></div>' +
          '<div class="brg-sw-stat"><span class="brg-sw-num">' + (st.dom !== null ? st.dom : "&mdash;") + '</span><span class="brg-sw-lab">Median days on market</span></div>' +
          "</div>";
      } else {
        mid = '<p class="brg-sw-msg">No MLS&reg; sales were recorded in ' + label +
          " in the last 90 days. Sales here are infrequent &mdash; see the wider Edmonton picture at the link below.</p>";
      }
      box.innerHTML =
        "<h3>" + label + "</h3>" +
        '<p class="brg-sw-sub">Homes sold in the last 90 days</p>' +
        mid +
        '<p class="brg-sw-credit">Data: REALTORS&reg; Association of Edmonton MLS&reg; via Bridge Realty Group. Updated monthly; information deemed reliable but not guaranteed.</p>' +
        '<a class="brg-sw-link" href="' + LINK_URL + '" target="_blank" rel="noopener">See every sale &rarr;</a>';
    }).catch(function () {
      box.innerHTML =
        "<h3>" + label + "</h3>" +
        '<p class="brg-sw-sub">Homes sold in the last 90 days</p>' +
        '<p class="brg-sw-msg">The latest sales figures could not be loaded just now &mdash; you can browse every recent Edmonton sale at the link below.</p>' +
        '<p class="brg-sw-credit">Data: REALTORS&reg; Association of Edmonton MLS&reg; via Bridge Realty Group.</p>' +
        '<a class="brg-sw-link" href="' + LINK_URL + '" target="_blank" rel="noopener">See every sale &rarr;</a>';
    });
  }

  function init() {
    injectCss();
    var els = document.querySelectorAll(".brg-sold-widget[data-area]");
    for (var i = 0; i < els.length; i++) {
      if (!els[i].getAttribute("data-brg-done")) {
        els[i].setAttribute("data-brg-done", "1");
        render(els[i], els[i].getAttribute("data-area"));
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
