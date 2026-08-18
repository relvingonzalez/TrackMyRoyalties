/**
 * WideLedger Premium — signed license verification (ECDSA P-256).
 *
 * Only licenses signed with tools/keys/private.pem will verify.
 * The private key is NOT shipped with the app.
 *
 * Honest limit: someone can still patch this JS to skip checks (true of all
 * offline apps). Forging a valid WL1 key without the private key is not practical.
 * App Store IAP is stronger against casual piracy when you ship natively.
 */
(function (global) {
  // Public JWK only — safe to ship.
  const PUBLIC_JWK = {
    kty: "EC",
    crv: "P-256",
    x: "jdWDy7SdwW6TztVU8oIrTK6xVCWLD1Lu8pF2cDSGC-c",
    y: "fXjRw6y-EdiN6F3OrdOjLtnNhiK5ltYeGO0fvZJYVRk",
    ext: true,
    key_ops: ["verify"],
  };

  let cryptoKeyPromise = null;

  function b64urlToBytes(s) {
    const pad = "=".repeat((4 - (s.length % 4)) % 4);
    const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function getVerifyKey() {
    if (!cryptoKeyPromise) {
      cryptoKeyPromise = crypto.subtle.importKey(
        "jwk",
        PUBLIC_JWK,
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["verify"]
      );
    }
    return cryptoKeyPromise;
  }

  /**
   * @returns {Promise<{ok:true, payload:object, license:string}|{ok:false, error:string}>}
   */
  async function verifyLicense(licenseString) {
    if (!licenseString || typeof licenseString !== "string") {
      return { ok: false, error: "No license key." };
    }
    const trimmed = licenseString.trim().replace(/\s+/g, "");
    const parts = trimmed.split(".");
    if (parts.length !== 3 || parts[0] !== "WL1") {
      return { ok: false, error: "Invalid license format (expected WL1.…)." };
    }

    let bodyBytes;
    let sig;
    try {
      bodyBytes = b64urlToBytes(parts[1]);
      sig = b64urlToBytes(parts[2]);
    } catch {
      return { ok: false, error: "Corrupt license encoding." };
    }
    if (sig.length !== 64) {
      return { ok: false, error: "Invalid signature length." };
    }

    try {
      const key = await getVerifyKey();
      const valid = await crypto.subtle.verify(
        { name: "ECDSA", hash: "SHA-256" },
        key,
        sig,
        bodyBytes
      );
      if (!valid) {
        return { ok: false, error: "Signature invalid — not issued with your private key." };
      }
    } catch {
      return {
        ok: false,
        error: "Crypto verification failed. Use the desktop app or http://localhost (not file://).",
      };
    }

    let payload;
    try {
      payload = JSON.parse(new TextDecoder().decode(bodyBytes));
    } catch {
      return { ok: false, error: "Corrupt license payload." };
    }

    if (payload.tier !== "premium") {
      return { ok: false, error: "License tier is not premium." };
    }
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now > Number(payload.exp)) {
      return { ok: false, error: "License expired." };
    }
    if (Number(payload.v) !== 1) {
      return { ok: false, error: "Unsupported license version." };
    }

    return { ok: true, payload, license: trimmed };
  }

  /**
   * Never trust a raw premium:true flag without a valid signature.
   */
  async function resolvePremium(state) {
    const key = state.licenseKey || "";
    if (!key) {
      return { premium: false, licenseMeta: null, error: null };
    }
    const result = await verifyLicense(key);
    if (!result.ok) {
      return { premium: false, licenseMeta: null, error: result.error };
    }
    return {
      premium: true,
      licenseMeta: {
        sub: result.payload.sub,
        exp: result.payload.exp,
        jti: result.payload.jti,
        iat: result.payload.iat,
      },
      error: null,
    };
  }

  global.WideLedgerLicense = {
    verifyLicense,
    resolvePremium,
    PUBLIC_JWK,
  };
})(window);
