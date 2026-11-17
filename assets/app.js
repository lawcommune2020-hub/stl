/* The Data Room: home (search / ask, core, themes, quick downloads), theme pages, company views. No dependencies. */
(function () {
  "use strict";
  var DR = window.DR || { companies: [], themes: [] };
  var PAGE = document.body.dataset.page, ROOT = document.body.dataset.root || "";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var inr = function (n) { var s = String(Math.round(Math.abs(n))); return s.length > 3 ? s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + s.slice(-3) : s; };
  var cmpf = function (v) { var d = v.toFixed(2).split("."); return "₹" + inr(+d[0]) + "." + d[1]; };
  var url = function (u) { return /^https?:/.test(u) ? u : ROOT + u; };

  /* ---------- quick-download menu: one open at a time; closes on any outside tap, Escape, resize ---------- */
  function closeMenus(except) {
    $$(".menu:not([hidden])").forEach(function (m) {
      if (m === except) return;
      m.hidden = true;
      var b = m.parentNode.querySelector(".dlbtn");
      if (b) b.setAttribute("aria-expanded", "false");
      var c = m.closest(".card");
      if (c) c.classList.remove("open");
    });
  }
  document.addEventListener("pointerdown", function (e) { if (!e.target.closest(".dlwrap")) closeMenus(); });
  /* light / dark switch: follows the device until the reader picks one, then remembers it */
  var themeBtn = $("#theme"), darkNow = function () { return document.documentElement.dataset.theme === "dark"; };
  var themeLabel = function () { if (themeBtn) themeBtn.textContent = darkNow() ? "Light" : "Dark"; };
  if (themeBtn) { themeLabel(); themeBtn.addEventListener("click", function () { var t = darkNow() ? "light" : "dark"; document.documentElement.dataset.theme = t; try { localStorage.setItem("dr_theme", t); } catch (e) {} themeLabel(); }); }
  document.addEventListener("click", function (e) {
    var b = e.target.closest(".dlbtn");
    if (b && !b.classList.contains("demo")) {
      var m = b.parentNode.querySelector(".menu");
      if (!m.hidden) { closeMenus(); return; }
      closeMenus(m);
      m.hidden = false; m.classList.remove("left");
      if (m.getBoundingClientRect().left < 8) m.classList.add("left");
      b.setAttribute("aria-expanded", "true");
      b.closest(".card").classList.add("open");
      return;
    }
    if (e.target.closest(".menu a")) setTimeout(closeMenus, 0);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var m = $(".menu:not([hidden])");
    if (!m) return;
    var b = m.parentNode.querySelector(".dlbtn");
    closeMenus();
    if (b) b.focus();
  });
  window.addEventListener("resize", function () { closeMenus(); });

  /* ---------- cards ---------- */
  function dlRow(d) {
    if (d.n) return '<div class="mi n"><span>' + esc(d.l) + "</span><em>not available</em></div>";
    var page = d.x === "page", ext = d.x === "ext", zip = d.x === "zip";
    var em = page ? "→" : ext ? "NSE ↗" : (zip ? "ZIP ↓ " : "PDF ↓ ") + d.s;
    var attrs = zip ? " download" : page ? "" : ' target="_blank" rel="noopener"';
    return '<a class="mi ' + (page ? "p" : ext ? "x" : "") + '" href="' + esc(url(d.u)) + '"' + attrs + "><span>" + esc(d.l) + "</span><em>" + em + "</em></a>";
  }
  function card(c) {
    return '<article class="card' + (c.core ? " core" : "") + '" data-id="' + c.id + '"><div class="ctop">' + (c.core ? '<span class="coretag">CORE</span>' : "<span></span>") +
      '<div class="dlwrap"><button type="button" class="dlbtn" aria-haspopup="true" aria-expanded="false" aria-label="Quick downloads for ' + esc(c.name) + '"><b>↓</b> PDFs</button>' +
      '<div class="menu" hidden><div class="mh">Quick downloads</div>' + c.dl.map(dlRow).join("") + "</div></div></div>" +
      '<h3><a href="' + ROOT + c.url + '">' + esc(c.name) + "</a></h3>" +
      '<a class="th" href="' + ROOT + "t/" + c.tslug + '/index.html">' + esc(c.theme) + "</a>" +
      '<p class="what">' + esc(c.what) + '</p>' + (c.why ? '<p class="why">' + esc(c.why) + "</p>" : "") +
      '<div class="cmp"><span>CMP </span>' + cmpf(c.cmp) + "</div></article>";
  }
  var byCap = function (a, b) { return b.mcap - a.mcap; };
  var grid = function (rows) { return '<div class="grid">' + rows.map(card).join("") + "</div>"; };

  /* ---------- search / ask ---------- */
  function lev(a, b) {
    var d = [], i, j;
    for (i = 0; i <= a.length; i++) d[i] = [i];
    for (j = 1; j <= b.length; j++) d[0][j] = j;
    for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  var STOP = /^(q[1-4]|fy\d+|results?|financials?|quarterly|annual|report|dossier|research|face|value|fv|mcap|market|cap|cmp|price|revenue|sales|profit|presentations?|concalls?|transcripts?|highlights?|filings?|show|me|the|of|for|what|is|s|calls?|download|pdf)$/;
  function parse(q) {
    var raw = q.trim().toLowerCase();
    var words = raw.split(/[^a-z0-9&]+/).filter(function (w) { return w && w !== "&" && !STOP.test(w); });
    /* every word must match some token of the company (name, ticker, theme, sector, alias); short words must match exactly as a substring */
    var thr = function (w) { return w.length <= 3 ? 0 : w.length <= 5 ? 1 : 2; };
    var score = function (c) {
      var toks = [c.sym.toLowerCase()].concat((c.name + " " + c.theme + " " + c.sector + " " + (c.alias || "")).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)), total = 0;
      for (var i = 0; i < words.length; i++) {
        var w = words[i], best = 99;
        for (var j = 0; j < toks.length; j++) { var t = toks[j], sc = t.indexOf(w) >= 0 ? 0 : lev(w, t.slice(0, w.length + 1)); if (sc < best) best = sc; }
        if (best > thr(w)) return 99;
        total += best;
      }
      return total;
    };
    return { raw: raw, words: words, score: score, lim: 98 };
  }
  function dlOf(c, k) { for (var i = 0; i < c.dl.length; i++) if (c.dl[i].k === k && !c.dl[i].n) return c.dl[i]; return null; }
  function answerFor(c, t) {
    var open = function (hash) { return ROOT + c.url + (hash || ""); };
    var nav = function (hash, label, dk) { return { t: label + " · " + c.name, s: "Opens the " + label.toLowerCase() + " folder", b: "Open", u: open(hash), dk: dk }; };
    var yoy = c.yoy === null ? "" : " · " + (c.yoy >= 0 ? "+" : "−") + Math.abs(c.yoy) + "% YoY";
    if (/face\s*value|\bfv\b/.test(t)) return { t: "₹" + c.fv + " face value", s: c.name + " (" + c.sym + ")", b: "Open " + c.sym, u: open() };
    if (/market\s*cap|mcap/.test(t)) return { t: "₹" + inr(c.mcap) + " cr market cap", s: c.name + " · Prices as of " + DR.priceDate, b: "Open " + c.sym, u: open() };
    if (/cmp|price/.test(t)) return { t: cmpf(c.cmp) + " CMP", s: c.name + " · As of " + DR.priceDate, b: "Open " + c.sym, u: open() };
    if (/revenue|sales/.test(t)) return { t: "₹" + inr(c.rev) + " cr revenue", s: c.name + " · " + c.ql + yoy, b: "Open results", u: open("#results"), dk: "results" };
    if (/profit|pat/.test(t)) return { t: (c.np < 0 ? "−" : "") + "₹" + inr(c.np) + " cr net profit", s: c.name + " · " + c.ql, b: "Open results", u: open("#results"), dk: "results" };
    if (/result|financial|q[1-4]|quarter|earnings/.test(t)) return nav("#results", "Quarterly results", "results");
    if (/dossier|research|thesis|risk/.test(t)) return nav("#dossier", "Dossier", "dossier");
    if (/annual/.test(t)) return nav("#annual", "Annual report");
    if (/presentation|concall|transcript|highlight|call/.test(t)) return nav("#decks", "Presentations & calls", /transcript|concall|call/.test(t) ? "call" : "pres");
    if (/filing|exchange/.test(t)) return nav("#filings", "Exchange filings");
    return null;
  }

  /* ---------- ask anything: server answer (cited), or closest passages when there is no server ---------- */
  var askEl = null, askSeq = 0, DRC_LOADED = null;
  var rich = function (t, srcs) {
    var byN = {}; (srcs || []).forEach(function (x) { byN[x.n] = x; });
    var h = esc(t).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/\[(\d+)\]/g, function (m, n) { var x = byN[n]; return x ? '<a class="cite" href="' + esc(url(x.url)) + '"' + (/^files\//.test(x.url) ? ' target="_blank" rel="noopener"' : "") + ' title="' + esc(x.title) + '">' + n + "</a>" : ""; });
    return h.split(/\n+/).map(function (l) { return /^\s*[-•]\s+/.test(l) ? '<p class="bl">' + l.replace(/^\s*[-•]\s+/, "") + "</p>" : "<p>" + l + "</p>"; }).join("");
  };
  var srcList = function (srcs, label) {
    if (!srcs || !srcs.length) return "";
    return '<div class="srcs"><div class="al">' + label + "</div>" + srcs.map(function (x) {
      var file = /^files\//.test(x.url), pg = /#page=(\d+)/.exec(x.url);
      return '<a class="src" href="' + esc(url(x.url)) + '"' + (file ? ' target="_blank" rel="noopener"' : "") + '><b>' + x.n + "</b><span><em>" + esc(x.title) + (pg ? " · p." + pg[1] : "") + "</em>" + esc(x.snippet) + "</span></a>";
    }).join("") + "</div>";
  };
  var STOPW = /^(a|an|the|of|for|to|in|on|at|by|is|are|was|be|and|or|what|which|who|how|do|does|did|has|have|can|me|my|about|tell|show|any|all)$/;
  function localSearch(q, sym, cb) {   // no server: rank the public passages in the browser
    var go = function () {
      var W = q.toLowerCase().split(/[^a-z0-9]+/).filter(function (w) { return w.length > 1 && !STOPW.test(w); }).map(function (w) { return w.replace(/(ing|es|s)$/, ""); });
      var raw = q.toLowerCase().replace(/'s\b/g, "").split(/[^a-z0-9]+/);
      var GEN = /^(limited|india|indian|power|energy|engineering|infrastructure|industries|solution|software|services|metal|metals|estate|network|networks|technologies|enterprise|enterprises)$/;
      var named = DR.companies.filter(function (c) {
        var ks = [c.sym.toLowerCase()].concat((c.name + " " + (c.alias || "")).toLowerCase().split(/[^a-z0-9]+/).filter(function (t) { return t.length >= 4 && !GEN.test(t); }));
        return ks.some(function (k) { return raw.indexOf(k) >= 0; });
      }).map(function (c) { return c.sym; });
      if (named.length > 1) {   /* "lloyds metals" names three group companies; prefer the one whose name matches on 2+ words */
        var strong = DR.companies.filter(function (c) { return named.indexOf(c.sym) >= 0 && c.name.toLowerCase().split(/[^a-z0-9]+/).filter(function (t) { return t.length >= 3 && raw.indexOf(t) >= 0; }).length >= 2; }).map(function (c) { return c.sym; });
        if (strong.length) named = strong;
      }
      if (!named.length && sym) named = [sym];
      var N = window.DRC.length, df = {};
      var rows = window.DRC.filter(function (c) { return !named.length || named.indexOf(c.sym) >= 0; }).map(function (c) { var t = (c.title + " " + c.text).toLowerCase(); return { c: c, t: t }; });
      W.forEach(function (w) { df[w] = rows.filter(function (r) { return r.t.indexOf(w) >= 0; }).length; });
      var scored = rows.map(function (r) {
        var sc = 0, ti = r.c.title.toLowerCase();
        W.forEach(function (w) {
          var n = r.t.split(w).length - 1;
          if (n) sc += Math.log(1 + N / (1 + df[w])) * (1 + Math.log(n)) * (ti.indexOf(w) >= 0 ? 1.6 : 1);
        });
        if (sym && r.c.sym === sym) sc *= 1.5;
        if (/#(orders|datacentres|story|capital|people|timeline|legal|media)$/.test(r.c.url)) sc *= 1.4;   /* the deep-dive pages are written to answer questions; the analyst dossier is the backstop */
        return { c: r.c, sc: sc };
      }).filter(function (x) { return x.sc > 0; }).sort(function (a, b) { return b.sc - a.sc; }).slice(0, 6);
      cb(scored.map(function (x, i) { return { n: i + 1, title: x.c.title, url: x.c.url, snippet: x.c.text.slice(0, 240) + (x.c.text.length > 240 ? "…" : "") }; }));
    };
    if (window.DRC) return go();
    var sc = document.createElement("script"); sc.src = ROOT + "assets/chunks.js?v=" + (document.documentElement.dataset.v || ""); sc.onload = go; sc.onerror = function () { cb([]); }; document.head.appendChild(sc);
  }
  var NOTE = '<p class="fine">Answers are written from the documents in this room and can contain mistakes. Check the cited pages. Not investment advice.</p>';
  function runAsk(q, sym) {
    q = (q || "").trim(); if (!q) return;
    var my = ++askSeq; askEl = askEl || $("#ask");
    askEl.hidden = false;
    if (PAGE === "company") window.scrollTo(0, 0);
    askEl.innerHTML = '<div class="al">Asking the room</div><div class="at q">' + esc(q) + '</div><div class="wait"><i></i><i></i><i></i> Reading the filings…</div>';
    var none = $("#none"); if (none) none.hidden = true;
    var done = function (html) { if (my === askSeq) { askEl.innerHTML = html; var n = $("#none"); if (n) n.hidden = true; } };
    var head = '<button type="button" class="askx" data-askclose>Close</button><div class="al">Answer</div><div class="at q">' + esc(q) + "</div>";
    var fallback = function (why) {
      localSearch(q, sym, function (srcs) {
        done(head + '<div class="body"><p>' + esc(why) + "</p></div>" + (srcs.length ? srcList(srcs, "Closest passages") : "<p>Nothing matching found.</p>") + NOTE);
      });
    };
    fetch(ROOT + "api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q: q, sym: sym || undefined }) })
      .then(function (r) { if (!r.ok && r.status !== 429 && r.status !== 503) throw new Error("no server"); return r.json(); })
      .then(function (j) {
        if (j.error === "rate" || j.error === "busy") return done(head + '<div class="body"><p>' + esc(j.detail) + "</p></div>");
        if (j.error) return done(head + '<div class="body"><p>The assistant is unavailable right now, so here are the closest passages from the documents.</p></div>' + srcList(j.sources, "Closest passages") + NOTE);
        var fu = (j.followups || []).map(function (f) { return '<button type="button" class="chip" data-ask="' + esc(f) + '">' + esc(f) + "</button>"; }).join("");
        done(head + '<div class="body">' + rich(j.answer, j.sources) + "</div>" + (fu ? '<div class="fu">' + fu + "</div>" : "") + srcList(j.sources, "Sources") + NOTE);
      })
      .catch(function () { fallback("Live answers aren't available on this copy of the room, so here are the closest passages from the documents."); });
  }
  document.addEventListener("click", function (e) { if (e.target.closest("[data-askclose]")) { askSeq++; var p = $("#ask"); if (p) p.hidden = true; } });
  var iAsk = function (q, sym) { if (!askEl) askEl = $("#ask"); runAsk(q, sym); };
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-ask]"); if (!b) return;
    var q = b.dataset.ask; var qi = $("#q"); if (qi) { qi.value = q; S.q = q; }
    iAsk(q, ASKSYM);
  });
  var ASKSYM = "";

  /* ---------- home + theme list ---------- */
  var S = { q: "", mode: "all", core: false, theme: "" };
  var listEl = $("#list");
  function render() {
    if (!listEl) return;
    var all = DR.companies.slice(), P = parse(S.q), rows = all, ans = null;
    if (PAGE === "theme") {
      rows = all.filter(function (c) { return c.theme === listEl.dataset.theme; }).sort(function (a, b) { return (b.core - a.core) || byCap(a, b); });
      listEl.innerHTML = grid(rows);
      return;
    }
    if (P.words.length) {
      rows = all.filter(function (c) { return P.score(c) <= P.lim; }).sort(function (a, b) { return P.score(a) - P.score(b); });
      if (rows.length) ans = answerFor(rows[0], P.raw);
    }
    if (S.theme) rows = rows.filter(function (c) { return c.theme === S.theme; });
    if (S.core) rows = rows.filter(function (c) { return c.core; });
    var html = "", sorted = rows.slice();
    if (!P.words.length) sorted.sort(function (a, b) { return (b.core - a.core) || byCap(a, b); });
    if (P.words.length) {
      html = grid(sorted);
    } else if (S.mode === "themes") {
      DR.themes.forEach(function (t) {
        var r = sorted.filter(function (c) { return c.theme === t.name; }).sort(byCap);
        if (r.length) html += '<div class="group"><h2>' + esc(t.name) + " <small>" + r.length + (r.length === 1 ? " company" : " companies") + '</small></h2><a href="' + ROOT + "t/" + t.slug + '/index.html">Theme research →</a></div>' + grid(r);
      });
    } else {
      var core = sorted.filter(function (c) { return c.core; }), rest = sorted.filter(function (c) { return !c.core; });
      if (core.length) html += '<div class="group core"><h2><i></i>Core stocks <small>' + core.length + "</small></h2></div>" + grid(core);
      if (rest.length) html += (core.length ? '<div class="group"><h2>Also on the watchlist <small>' + rest.length + "</small></h2></div>" : "") + grid(rest);
    }
    listEl.innerHTML = html;
    $("#none").hidden = rows.length > 0;
    var a = $("#answer");
    if (ans) {
      var c0 = rows[0] || all[0], dk = ans.dk && dlOf(c0, ans.dk);
      a.innerHTML = '<div class="al">Answer</div><div class="at">' + esc(ans.t) + '</div><div class="as">' + esc(ans.s) + '</div><div class="ab"><a class="btn sm" href="' + esc(ans.u) + '">' + esc(ans.b) + " →</a>" +
        (dk ? '<a class="btn sm ghost" href="' + esc(url(dk.u)) + '" target="_blank" rel="noopener">↓ ' + esc(dk.l) + "</a>" : "") + '<button type="button" class="btn sm ghost" data-ask="' + esc(S.q) + '">Ask in full</button></div>';
      a.hidden = false;
    } else a.hidden = true;
  }
  function chips() {
    var el = $("#themechips");
    if (!el || DR.themes.length < 2) return;
    el.innerHTML = '<button type="button" data-theme="" class="' + (S.theme ? "" : "on") + '">All themes</button>' +
      DR.themes.map(function (t) { return '<button type="button" data-theme="' + esc(t.name) + '" class="' + (S.theme === t.name ? "on" : "") + '">' + esc(t.name) + "<small>" + t.n + "</small></button>"; }).join("");
  }
  if (PAGE === "home") {
    var qs = new URLSearchParams(location.search), qin = $("#q");
    S.q = qs.get("q") || ""; qin.value = S.q; ASKSYM = (qs.get("sym") || "").toUpperCase();
    /* an instant card is enough for short lookups like "diacabs face value"; anything longer or unmatched goes to the assistant */
    var wantsAsk = function () { var a = $("#answer"); return !(a && !a.hidden && S.q.trim().split(/\s+/).length <= 4); };
    qin.addEventListener("input", function () { S.q = qin.value; ASKSYM = ""; closeMenus(); askSeq++; var a = $("#ask"); if (a) a.hidden = true; render(); });
    $(".search").addEventListener("submit", function (e) { e.preventDefault(); qin.blur(); if (S.q.trim() && wantsAsk()) iAsk(S.q, ASKSYM); });
    $$(".seg [data-mode]").forEach(function (b) {
      b.addEventListener("click", function () { S.mode = b.dataset.mode; $$(".seg [data-mode]").forEach(function (x) { x.classList.toggle("on", x === b); }); render(); });
    });
    $("#coreonly").addEventListener("click", function () { S.core = !S.core; this.setAttribute("aria-pressed", S.core); render(); });
    $("#themechips").addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      S.theme = b.dataset.theme; chips(); render();
    });
    chips(); render();
    if (S.q.trim() && qs.get("sym") !== null && wantsAsk()) iAsk(S.q, ASKSYM);
    else if (S.q.trim().split(/\s+/).length > 4) iAsk(S.q, ASKSYM);
  } else if (PAGE === "theme") {
    render();
  }

  /* ---------- company views (#dossier #results #annual #decks #filings #files) ---------- */
  if (PAGE === "company") {
    ASKSYM = $(".co").dataset.sym; var sf0 = $(".search"); if (sf0) sf0.addEventListener("submit", function (e) { e.preventDefault(); var qv = $("#q").value; if (qv.trim()) iAsk(qv, ASKSYM); });
    var sf = $(".search"); if (sf) { var hi = document.createElement("input"); hi.type = "hidden"; hi.name = "sym"; hi.value = $(".co").dataset.sym; sf.appendChild(hi); }
    var VIEWS = $$("[data-view]").map(function (x) { return x.dataset.view; });
    var sym = $(".co").dataset.sym, back = $("#back"), cur = null;
    var show = function () {
      var h = location.hash.slice(1);
      if (VIEWS.indexOf(h) < 0) h = "home";
      $$("[data-view]").forEach(function (s) { s.classList.toggle("on", s.dataset.view === h); });
      back.textContent = h === "home" ? "← Companies" : "← " + sym;
      back.setAttribute("href", h === "home" ? ROOT + "index.html" : "#");
      if (document.body.dataset.scoped) back.style.display = h === "home" ? "none" : "";
      if (cur !== null && cur !== h) window.scrollTo(0, 0);
      cur = h;
    };
    window.addEventListener("hashchange", show);
    show();
    $$(".seg [data-basis]").forEach(function (b) {
      b.addEventListener("click", function () {
        $$(".seg [data-basis]").forEach(function (x) { x.classList.toggle("on", x === b); });
        $$(".tablewrap").forEach(function (t) { t.hidden = t.dataset.basis !== b.dataset.basis; });
      });
    });
    $$(".tablewrap").forEach(function (t, i) { t.hidden = i > 0; });
  }
})();
