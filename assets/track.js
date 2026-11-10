/* Mesure d'audience Flip — anonyme, sans cookie, sans adresse IP.
   Respecte « Ne pas me suivre ». Les visites du vendeur (connecté à admin) ne sont pas comptées. */
(function () {
  var URL_T = "https://mqgjwyqpibbthfgcthva.supabase.co/functions/v1/track";
  try {
    if (navigator.doNotTrack === "1" || window.doNotTrack === "1" || navigator.webdriver) return;
    if (localStorage.getItem("flip-no-track") === "1") return;
  } catch (e) {}

  function rid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
  function store(s, k) { try { var v = s.getItem(k); if (!v) { v = rid(); s.setItem(k, v); } return v; } catch (e) { return rid(); } }
  var vid = store(localStorage, "flip-vid"), sid = store(sessionStorage, "flip-sid");
  var q = new URLSearchParams(location.search);
  var ref = "";
  try { var r = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, "") : ""; ref = r === location.hostname ? "" : r; } catch (e) {}
  var base = {
    vid: vid, sid: sid, page: location.pathname.replace(/^.*\//, "/") || "/", ref: ref,
    us: q.get("utm_source"), um: q.get("utm_medium"), uc: q.get("utm_campaign"), ut: q.get("utm_content"),
    device: window.innerWidth < 760 ? "mobile" : window.innerWidth < 1100 ? "tablette" : "ordinateur",
    tz: (Intl.DateTimeFormat().resolvedOptions().timeZone || ""), lang: navigator.language || "",
    theme: document.documentElement.getAttribute("data-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
    w: window.innerWidth
  };
  var queue = [];
  function flush() {
    if (!queue.length) return;
    var body = JSON.stringify(Object.assign({}, base, { events: queue.splice(0, 30) }));
    try { if (navigator.sendBeacon && navigator.sendBeacon(URL_T, new Blob([body], { type: "text/plain" }))) return; } catch (e) {}
    try { fetch(URL_T, { method: "POST", body: body, keepalive: true, headers: { "Content-Type": "text/plain" } }); } catch (e) {}
  }
  function send(type, label, value, now) { queue.push({ type: type, label: label || null, value: value == null ? null : value }); if (now || queue.length >= 10) flush(); }
  window.flipTrack = send;

  send("pageview", null, null, true);

  // Clics : boutons d'achat (data-track="cta-…"), liens, boutons
  document.addEventListener("click", function (e) {
    var el = e.target.closest && e.target.closest("a, button");
    if (!el) return;
    var label = el.getAttribute("data-track");
    if (!label) {
      var t = (el.textContent || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 40);
      var h = el.getAttribute("href") || "";
      label = (t || "bouton") + (h && h[0] !== "#" ? " → " + h.replace(/^https?:\/\/(www\.)?/, "").split(/[/?#]/)[0] : "");
    }
    send("click", label, null, true);
  }, true);

  // Sections vues (une fois par page)
  if ("IntersectionObserver" in window) {
    var seen = {};
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        var k = en.target.getAttribute("data-section");
        if (en.isIntersecting && !seen[k]) { seen[k] = 1; send("section", k); io.unobserve(en.target); }
      });
    }, { threshold: 0.35 });
    Array.prototype.forEach.call(document.querySelectorAll("[data-section]"), function (s) { io.observe(s); });
  }

  // Profondeur de défilement (25 / 50 / 75 / 100 %)
  var marks = [25, 50, 75, 100], hit = {};
  function onScroll() {
    var d = document.documentElement, max = d.scrollHeight - innerHeight;
    var p = max <= 0 ? 100 : Math.round(scrollY / max * 100);
    marks.forEach(function (m) { if (p >= m - 2 && !hit[m]) { hit[m] = 1; send("scroll", null, m); } });
  }
  addEventListener("scroll", onScroll, { passive: true }); setTimeout(onScroll, 1500);

  // Vidéo de démo : lecture et progression
  Array.prototype.forEach.call(document.querySelectorAll("video"), function (v) {
    var done = {};
    v.addEventListener("play", function () { if (!done.play) { done.play = 1; send("video", "lecture", null, true); } });
    v.addEventListener("timeupdate", function () {
      if (!v.duration) return; var p = v.currentTime / v.duration * 100;
      [25, 50, 75, 95].forEach(function (m) { if (p >= m && !done[m]) { done[m] = 1; send("video", m === 95 ? "fin" : m + "%"); } });
    });
  });

  // Temps réellement passé (onglet visible), envoyé quand on quitte ou cache la page
  var active = 0, last = Date.now(), visible = !document.hidden;
  function tick() { if (visible) active += (Date.now() - last) / 1000; last = Date.now(); }
  document.addEventListener("visibilitychange", function () {
    tick(); visible = !document.hidden;
    if (document.hidden) { send("ping", null, Math.round(active)); flush(); }
  });
  addEventListener("pagehide", function () { tick(); send("ping", null, Math.round(active)); flush(); });
  setInterval(flush, 15000);
})();
