// t191 #3: keep automated test browsers out of Cloudflare Web Analytics.
// Every context (and every browser.newPage) aborts requests to the Web Analytics beacon script
// (static.cloudflareinsights.com) and its reporting endpoint (/cdn-cgi/rum), so test runs are never counted.
export const isBeacon = (url) => { try { const u = new URL(url); return u.hostname === "static.cloudflareinsights.com" || u.pathname.startsWith("/cdn-cgi/rum"); } catch { return false; } };
export const blocked = [];
const guard = async (ctx) => { await ctx.route(isBeacon, (route) => { blocked.push(route.request().url()); return route.abort("blockedbyclient"); }); return ctx; };
export function blockBeacon(browser) {
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (...a) => guard(await newContext(...a));
  browser.newPage = async (opts = {}) => { const c = await browser.newContext(opts); const p = await c.newPage(); p.once("close", () => c.close().catch(() => {})); return p; };
  return browser;
}
