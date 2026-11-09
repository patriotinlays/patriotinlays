// Namespaced localStorage helpers shared by both tools. Nothing here touches the network.
export function ns(prefix, storage = globalThis.localStorage) {
  return {
    get(key, fallback) { try { const v = storage?.getItem(prefix + key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } },
    set(key, value) { try { storage?.setItem(prefix + key, JSON.stringify(value)); return true; } catch { return false; } },
    clear() { // removes only this tool's keys
      if (!storage) return 0; const doomed = [];
      for (let i = 0; i < storage.length; i++) { const k = storage.key(i); if (k && k.startsWith(prefix)) doomed.push(k); }
      doomed.forEach((k) => storage.removeItem(k)); return doomed.length;
    },
  };
}
export const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k === "text") n.textContent = v; else if (k.startsWith("on")) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? "" : v); }
  for (const c of kids.flat()) if (c != null) n.append(c.nodeType ? c : document.createTextNode(String(c)));
  // Printing shows a compact source reference (the site's name, e.g. "archives.gov") instead of the full link address.
  if (tag === "a" && /^https?:/.test(attrs.href || "")) { try { n.dataset.host = new URL(attrs.href).hostname.replace(/^www\./, ""); } catch { /* not a full URL */ } }
  // t124u #11: links that leave the site open in a new tab, with a small icon and screen-reader text (same markup as the build).
  if (tag === "a" && isExternal(attrs.href || "")) markExternal(n);
  return n;
};
export const isExternal = (u) => /^https?:\/\//i.test(u) && !/^https?:\/\/(www\.)?patriotinlays\.com(\/|$)/i.test(u);
export function markExternal(a) {
  a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener noreferrer"); a.classList.add("ext");
  const NS = "http://www.w3.org/2000/svg", svg = document.createElementNS(NS, "svg");
  for (const [k, v] of Object.entries({ class: "ext-icon", "aria-hidden": "true", focusable: "false", width: "12", height: "12", viewBox: "0 0 12 12" })) svg.setAttribute(k, v);
  const path = document.createElementNS(NS, "path");
  for (const [k, v] of Object.entries({ d: "M7 1h4v4M11 1 5.5 6.5M9.5 7.5V11H1V2.5h3.5", fill: "none", stroke: "currentColor", "stroke-width": "1.4", "stroke-linecap": "round", "stroke-linejoin": "round" })) path.setAttribute(k, v);
  svg.append(path); const sr = document.createElement("span"); sr.className = "sr-only"; sr.textContent = " (opens in new tab)";
  a.append(svg, sr); return a;
}
