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
  return n;
};
