/* t154: open any <details> the URL hash points to, or that contains the hashed element. Progressive enhancement; the page works without this. */
(function () {
  function openHash() {
    var raw = location.hash.slice(1);
    if (!raw) return;
    var id;
    try { id = decodeURIComponent(raw); } catch (e) { id = raw; }
    if (!id) return;
    var el = document.getElementById(id);
    if (!el) return;
    var n = el;
    while (n) {
      if (n.tagName === "DETAILS") n.open = true;
      n = n.parentElement;
    }
    if (typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "start" });
  }
  function onClick(e) {
    var a = e.target && e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    var u;
    try { u = new URL(a.href, location.href); } catch (err) { return; }
    if (u.origin !== location.origin || u.pathname !== location.pathname || !u.hash || u.hash === "#") return;
    var same = false;
    try { same = decodeURIComponent(u.hash) === decodeURIComponent(location.hash); }
    catch (err) { same = u.hash === location.hash; }
    if (!same) return; // a different hash is handled by hashchange
    setTimeout(openHash, 0);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", openHash);
  else openHash();
  window.addEventListener("hashchange", openHash);
  document.addEventListener("click", onClick);
})();
