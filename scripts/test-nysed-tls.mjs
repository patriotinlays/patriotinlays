// Fails loudly when nysed.gov changes its issuer, so the pinned intermediate gets reviewed.
// Verification is never disabled anywhere in the check.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import tls from "node:tls";
import { isNysedHost, nysedGet, NYSED_ISSUER, NYSED_ISSUER_CN } from "./lib/nysed-tls.mjs";

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); ok ? pass++ : fail++; };

const pem = readFileSync(new URL("../manifest/nysed-intermediate.pem", import.meta.url).pathname, "utf8");
const subj = execFileSync("openssl", ["x509", "-noout", "-subject", "-nameopt", "RFC2253"], { input: pem, encoding: "utf8" }).trim().replace("subject=", "").split(",").map(p=>p.trim()).sort().join(", ");
check(`Pinned intermediate is the ${NYSED_ISSUER_CN}`, subj === NYSED_ISSUER.split(",").map(p=>p.trim()).sort().join(", "), subj);
check("Only nysed.gov hosts get the extra CA", isNysedHost("nysl.nysed.gov") && isNysedHost("archives.nysed.gov") && !isNysedHost("example.com") && !isNysedHost("nysed.gov.evil.com"));
check("No verification-disabling flags in the checker", !/NODE_TLS_REJECT_UNAUTHORIZED\s*=|rejectUnauthorized:\s*false/.test([readFileSync(new URL("./check-manifest.mjs", import.meta.url).pathname, "utf8"), readFileSync(new URL("./lib/nysed-tls.mjs", import.meta.url).pathname, "utf8")].map(t => t.split("\n").filter(l => !l.trim().startsWith("//") && !l.trim().startsWith("*")).join("\n")).join("\n")));

for (const host of ["nysl.nysed.gov", "archives.nysed.gov"]) {
  try {
    const r = await nysedGet(`https://${host}/`, 45000);
    const issuer = r.cert && r.cert.issuer ? r.cert.issuer.CN : "(no peer certificate)";
    check(`${host} verifies with the pinned intermediate`, r.status < 400 && issuer === NYSED_ISSUER_CN, `HTTP ${r.status}, issuer ${issuer}`);
  } catch (e) {
    check(`${host} verifies with the pinned intermediate (ISSUER CHANGE? review manifest/nysed-intermediate.pem)`, false, e.message);
  }
}
console.log(`\nnysed TLS: ${pass}/${pass + fail} passed.`);
process.exit(fail ? 1 : 0);
