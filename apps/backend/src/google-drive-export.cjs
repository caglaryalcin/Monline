const crypto = require("node:crypto");
const MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const SCOPE = "https://www.googleapis.com/auth/drive.file";

async function tokenRequest(fields, config) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.client_id,
      client_secret: config.client_secret,
      ...fields,
    }),
    signal: AbortSignal.timeout(30000), redirect: "error",
  });
  const result = await response.json();
  if (!response.ok || !result.access_token)
    throw new Error(result.error === "invalid_grant"
      ? "spreadsheet_schedule_reconnect" : "spreadsheet_schedule_drive_failed");
  return result;
}

function authorizationUrl(redirectUri, state, verifier, config) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: config.client_id,
    redirect_uri: redirectUri, response_type: "code", scope: SCOPE,
    access_type: "offline", prompt: "consent", state,
    code_challenge: crypto.createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  }).toString();
  return url.href;
}

async function exchangeCode(code, redirectUri, verifier, config) {
  const token = await tokenRequest({
    code, redirect_uri: redirectUri, code_verifier: verifier,
    grant_type: "authorization_code",
  }, config);
  if (!token.refresh_token || !String(token.scope || "").split(" ").includes(SCOPE))
    throw new Error("spreadsheet_schedule_reconnect");
  return token.refresh_token;
}

async function uploadSpreadsheet(bytes, refreshToken, fileId, marker, persistFileId, config) {
  const token = await tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" }, config);
  const headers = { Authorization: "Bearer " + token.access_token };
  const request = async (url, options = {}) => fetch(url, {
    ...options, headers: { ...headers, ...options.headers },
    signal: AbortSignal.timeout(120000), redirect: "error",
  });
  if (fileId) {
    const existing = await request("https://www.googleapis.com/drive/v3/files/" +
      encodeURIComponent(fileId) + "?fields=id,trashed");
    if (existing.status === 404) fileId = "";
    else if (!existing.ok) throw new Error("spreadsheet_schedule_drive_failed");
    else if ((await existing.json()).trashed) fileId = "";
  }
  if (!fileId) {
    // Recover the app-created file after reconnects or interrupted uploads.
    const query = new URLSearchParams({
      q: "trashed = false and appProperties has { key='monlineExport' and value='" + marker + "' }",
      fields: "files(id)", pageSize: "1",
    });
    const existing = await request("https://www.googleapis.com/drive/v3/files?" + query);
    if (!existing.ok) throw new Error("spreadsheet_schedule_drive_failed");
    fileId = (await existing.json()).files?.[0]?.id || "";
  }
  if (!fileId) {
    const created = await request("https://www.googleapis.com/drive/v3/files?fields=id", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Monline.xlsx", mimeType: MIME,
        appProperties: { monlineExport: marker } }),
    });
    if (!created.ok) throw new Error("spreadsheet_schedule_drive_failed");
    fileId = (await created.json()).id;
  }
  // Persist the identity before uploading so retries always replace this file.
  persistFileId(fileId);
  const started = await request("https://www.googleapis.com/upload/drive/v3/files/" +
    encodeURIComponent(fileId) + "?uploadType=resumable&fields=id", {
    method: "PATCH", headers: {
      "Content-Type": "application/json", "X-Upload-Content-Type": MIME,
      "X-Upload-Content-Length": String(bytes.length),
    }, body: "{}",
  });
  if (!started.ok) throw new Error("spreadsheet_schedule_drive_failed");
  const location = new URL(started.headers.get("location") || "");
  if (location.protocol !== "https:" || location.hostname !== "www.googleapis.com" ||
      !location.pathname.startsWith("/upload/drive/"))
    throw new Error("spreadsheet_schedule_drive_failed");
  const uploaded = await request(location.href, {
    method: "PUT", headers: { "Content-Type": MIME, "Content-Length": String(bytes.length) },
    body: bytes,
  });
  if (!uploaded.ok) throw new Error("spreadsheet_schedule_drive_failed");
  return fileId;
}

async function revoke(refreshToken) {
  const response = await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: refreshToken }),
    signal: AbortSignal.timeout(15000), redirect: "error",
  });
  if (!response.ok && response.status !== 400)
    throw new Error("spreadsheet_schedule_drive_failed");
}
module.exports = { authorizationUrl, exchangeCode, uploadSpreadsheet, revoke };
