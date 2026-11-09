// nysl.nysed.gov and archives.nysed.gov don't send their intermediate certificate, so Node's
// default verification fails. Add ONLY that intermediate, ONLY for *.nysed.gov requests, with
// certificate verification left fully on. No NODE_TLS_REJECT_UNAUTHORIZED, no rejectUnauthorized:false.
import { readFileSync, existsSync } from "node:fs";
import tls from "node:tls";
import https from "node:https";

const PEM = new URL("../../manifest/nysed-intermediate.pem", import.meta.url).pathname;
// Re-pinned Nov 9, 2026: nysed.gov's certificate renewed Nov 3, 2026 under GlobalSign GCC R46 OV TLS CA 2025 (replacing
// GlobalSign RSA OV SSL CA 2018). The intermediate came from the CA-issuers URL in nysed's own certificate
// (secure.globalsign.com/cacert/gsgccr46ovtlsca2025.crt), SHA-256 D1:60:E2:DE:...:C0:40:63:F9, and chains to GlobalSign Root R46.
export const NYSED_ISSUER = "C=BE, O=GlobalSign nv-sa, CN=GlobalSign GCC R46 OV TLS CA 2025";
export const NYSED_ISSUER_CN = "GlobalSign GCC R46 OV TLS CA 2025";

export function isNysedHost(hostname) {
  return /(^|\.)nysed\.gov$/i.test(hostname || "");
}

// fetch() in Node has no per-request ca option, so the checker routes only nysed.gov through this.
export function nysedGet(url, timeoutMs = 60000) {
  return new Promise((resolvePromise, reject) => {
    const req = https.get(url, {
      ca: [...tls.rootCertificates, readFileSync(PEM, "utf8")],
      rejectUnauthorized: true,
      headers: { "user-agent": "Mozilla/5.0 (patriotinlays manifest checker)", accept: "text/html,*/*" },
      timeout: timeoutMs,
    }, (res) => {
      const chunks = [];
      const cert = res.socket ? res.socket.getPeerCertificate() : null;
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolvePromise({ status: res.statusCode, body: Buffer.concat(chunks).toString("utf8"), type: res.headers["content-type"] || "", cert }));
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("TimeoutError: nysed request timed out")));
    req.on("error", reject);
  });
}

export function nysedAvailable() { return existsSync(PEM); }
