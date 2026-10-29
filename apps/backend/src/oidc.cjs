const crypto = require("node:crypto");
const { DataRecord } = require("./storage.cjs");
const {
  BadRequestError,
  ForbiddenError,
  UnauthorizedError,
} = require("./errors.cjs");
function registerOidc(app, repository, auth) {
  const pending = new Map(),
    discovery = new Map(),
    keySets = new Map();
  const settings = () =>
    repository.findRecordsByFilter("admin_settings", "", "", 1)[0];
  const configured = (record) =>
    record?.getBool("oidc_enabled") &&
    record.getString("oidc_client_id") &&
    record.getString("oidc_issuer_url") &&
    record.getString("oidc_redirect_url");
  async function endpoints(record) {
    const issuer = record.getString("oidc_issuer_url").replace(/\/$/, "");
    if (discovery.get(issuer)?.expires > Date.now())
      return discovery.get(issuer).value;
    const response = await fetch(issuer + "/.well-known/openid-configuration", {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new BadRequestError("OIDC discovery failed");
    const value = await response.json();
    if (
      String(value.issuer).replace(/\/$/, "") !== issuer ||
      !value.authorization_endpoint ||
      !value.token_endpoint ||
      !value.jwks_uri
    )
      throw new BadRequestError("Invalid OIDC discovery document");
    for (const key of [
      "issuer",
      "authorization_endpoint",
      "token_endpoint",
      "jwks_uri",
      "userinfo_endpoint",
    ])
      if (
        value[key] &&
        !["http:", "https:"].includes(new URL(value[key]).protocol)
      )
        throw new BadRequestError("Invalid OIDC endpoint");
    discovery.set(issuer, { expires: Date.now() + 3600000, value });
    return value;
  }
  app.get("/api/auth/oidc/config", (req, res) => {
    const record = settings();
    res.set("Cache-Control", "no-store").json({
      enabled: !!configured(record) && !record.getBool("disable_login"),
      provider_name: record?.getString("oidc_provider_name") || "",
    });
  });
  app.get("/api/auth/oidc/authorize", async (req, res) => {
    const record = settings();
    if (!configured(record))
      throw new BadRequestError("OIDC is not configured");
    if (record.getBool("disable_login"))
      throw new ForbiddenError("Logins are currently disabled");
    const provider = await endpoints(record);
    const state = crypto.randomBytes(32).toString("base64url"),
      nonce = crypto.randomBytes(32).toString("base64url"),
      verifier = crypto.randomBytes(32).toString("base64url");
    for (const [key, value] of pending)
      if (value.expires < Date.now()) pending.delete(key);
    if (pending.size > 1000)
      throw new BadRequestError("Too many pending sign-ins");
    pending.set(state, {
      remember: req.query.remember === "true",
      nonce,
      verifier,
      expires: Date.now() + 600000,
      issuer: provider.issuer,
      clientId: record.getString("oidc_client_id"),
    });
    res.cookie("monline_oidc", state, {
      httpOnly: true,
      secure: req.secure,
      sameSite: "lax",
      maxAge: 600000,
      path: "/",
    });
    const url = new URL(provider.authorization_endpoint);
    for (const [key, value] of Object.entries({
      response_type: "code",
      client_id: record.getString("oidc_client_id"),
      redirect_uri: record.getString("oidc_redirect_url"),
      scope: record.getString("oidc_scopes") || "openid profile email",
      state,
      nonce,
      code_challenge: crypto
        .createHash("sha256")
        .update(verifier)
        .digest("base64url"),
      code_challenge_method: "S256",
    }))
      url.searchParams.set(key, value);
    res
      .set("Cache-Control", "no-store")
      .json({ authorization_url: url.href, state });
  });
  app.post("/api/auth/oidc/callback", async (req, res) => {
    const record = settings();
    if (!configured(record) || record.getBool("disable_login"))
      throw new ForbiddenError("OIDC sign-in is unavailable");
    const state = String(req.body.state || ""),
      flow = pending.get(state);
    if (
      !flow ||
      flow.expires < Date.now() ||
      state !== auth.cookieValue(req, "monline_oidc")
    )
      throw new UnauthorizedError("Invalid or expired OIDC state");
    pending.delete(state);
    res.clearCookie("monline_oidc", { path: "/" });
    const provider = await endpoints(record),
      clientId = record.getString("oidc_client_id");
    if (flow.issuer !== provider.issuer || flow.clientId !== clientId)
      throw new UnauthorizedError("OIDC configuration changed");
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: String(req.body.code || ""),
      redirect_uri: record.getString("oidc_redirect_url"),
      code_verifier: flow.verifier,
    });
    const headers = {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    };
    const methods = provider.token_endpoint_auth_methods_supported || [
      "client_secret_basic",
    ];
    if (methods.includes("client_secret_basic"))
      headers.Authorization =
        "Basic " +
        Buffer.from(
          encodeURIComponent(clientId) +
            ":" +
            encodeURIComponent(record.getString("oidc_client_secret")),
        ).toString("base64");
    else {
      body.set("client_id", clientId);
      body.set("client_secret", record.getString("oidc_client_secret"));
    }
    const response = await fetch(provider.token_endpoint, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new UnauthorizedError("OIDC code exchange failed");
    const credentials = await response.json();
    if (!credentials.id_token)
      throw new UnauthorizedError("Missing OIDC ID token");
    const { createRemoteJWKSet, jwtVerify } = await import("jose");
    if (!keySets.has(provider.jwks_uri))
      keySets.set(
        provider.jwks_uri,
        createRemoteJWKSet(new URL(provider.jwks_uri), {
          timeoutDuration: 10000,
        }),
      );
    const { payload } = await jwtVerify(
      credentials.id_token,
      keySets.get(provider.jwks_uri),
      {
        issuer: provider.issuer,
        audience: clientId,
        algorithms: [
          "RS256",
          "RS384",
          "RS512",
          "PS256",
          "PS384",
          "PS512",
          "ES256",
          "ES384",
          "ES512",
          "EdDSA",
        ],
        requiredClaims: ["sub", "iat", "exp", "nonce"],
      },
    );
    if (
      payload.nonce !== flow.nonce ||
      (Array.isArray(payload.aud) &&
        payload.aud.length > 1 &&
        payload.azp !== clientId)
    )
      throw new UnauthorizedError("Invalid OIDC ID token");
    let claims = payload;
    if (provider.userinfo_endpoint && credentials.access_token) {
      const infoResponse = await fetch(provider.userinfo_endpoint, {
        headers: { Authorization: "Bearer " + credentials.access_token },
        signal: AbortSignal.timeout(10000),
      });
      if (!infoResponse.ok)
        throw new UnauthorizedError("OIDC user information unavailable");
      const info = await infoResponse.json();
      if (info.sub !== payload.sub)
        throw new UnauthorizedError("OIDC subject mismatch");
      claims = { ...payload, ...info };
    }
    const profile =
      require("./domain/lib/pure/oidc-core.js").extractOidcProfile(claims);
    if (!profile.subject || !profile.email)
      throw new UnauthorizedError("OIDC provider must supply an email address");
    // Existing installations bound the provider's subject directly. There is one
    // configured issuer per installation; changing issuers requires unlinking users.
    let user = repository.findRecordsByFilter(
      "users",
      "oidc_subject = {:subject}",
      "",
      1,
      0,
      { subject: profile.subject },
    )[0];
    if (!user) {
      user = repository.findRecordsByFilter(
        "users",
        "email = {:email}",
        "",
        1,
        0,
        { email: profile.email },
      )[0];
      if (user?.getBool("disabled"))
        throw new ForbiddenError("account_disabled");
      if (user && (!profile.emailVerified || user.getString("oidc_subject")))
        throw new ForbiddenError("OIDC account cannot be linked");
      if (!user) {
        const policy = {
          openRegistrations: record.getBool("open_registrations"),
          maxUsers: record.getFloat("max_users"),
          disableLogin: record.getBool("disable_login"),
        };
        const reason =
          require("./domain/lib/pure/registration-policy.js").registrationRejection(
            policy,
            repository.countRecords("users"),
          );
        if (reason) throw new ForbiddenError(reason);
        user = new DataRecord(repository.findCollectionByNameOrId("users"));
        user.set("email", profile.email);
        user.set("name", profile.name);
        user.set("verified", profile.emailVerified);
        user.setPassword(crypto.randomBytes(32).toString("base64url"));
        for (const field of [
          "show_logo_on_card",
          "show_price_on_card",
          "show_cycle_on_card",
          "show_payment_method_on_card",
          "show_category_on_card",
          "show_payer_on_card",
          "show_next_payment_on_card",
          "monthly_price",
        ])
          user.set(field, true);
      }
      user.set("oidc_subject", profile.subject);
      repository.save(user);
    }
    if (user.getBool("disabled")) throw new ForbiddenError("account_disabled");
    if (
      user.getBool("totp_enabled") &&
      auth.resolve(auth.cookieValue(req, "monline_device"), "device") !==
        user.id
    ) {
      const issued =
        require("./domain/lib/totp-challenge.js").createTotpLoginChallenge(
          user,
          flow.remember,
        );
      return res.json({
        challenge: issued.challenge,
        expires_at: issued.expiresAt,
        user_id: user.id,
      });
    }
    return auth.sessionResponse(req, res, user, flow.remember);
  });
}
module.exports = { registerOidc };
