// Shared by test notifications and scheduled reminders.
function ntfyRequest(serverUrl, topic, title, message, auth = {}) {
  const { username = "", password = "", token = "" } = auth;
  const headers = {
    "Content-Type": "text/plain; charset=utf-8",
    // Fetch rejects Unicode headers; ntfy supports RFC 2047 encoded titles.
    Title: /[^\x20-\x7e]/.test(title)
      ? "=?UTF-8?B?" + Buffer.from(title, "utf8").toString("base64") + "?="
      : title,
  };
  if (token) headers.Authorization = "Bearer " + token;
  else if (username || password) {
    if (!username || !password || username.includes(":")) {
      const error = new Error(
        "ntfy requires both a username (without ':') and a password",
      );
      error.code = "ntfy_invalid_credentials";
      throw error;
    }
    headers.Authorization =
      "Basic " +
      Buffer.from(username + ":" + password, "utf8").toString("base64");
  }
  return {
    url: (serverUrl || "https://ntfy.sh").replace(/\/+$/, "") + "/" + topic,
    method: "POST",
    headers,
    body: message,
  };
}

module.exports = { ntfyRequest };
