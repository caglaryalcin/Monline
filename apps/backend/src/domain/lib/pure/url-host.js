const HTTP_URL_RE =
  /^https?:\/\/(?:[^@/?#]*@)?(\[[^\]]*\]|[^/?#:]*)(?::\d+)?(?=[/?#]|$)([^?#]*)(?:\?([^#]*))?/i;

/** Returns { host, path, query } for an absolute http(s) URL, or null. */
function parseHttpUrl(value) {
  const match = HTTP_URL_RE.exec(String(value || "").trim());
  if (!match || !match[1]) return null;
  return {
    host: match[1].toLowerCase(),
    path: match[2] || "/",
    query: match[3] || "",
  };
}

/** True when `host` is `domain` itself or one of its subdomains. */
function isHostOrSubdomain(host, domain) {
  return host === domain || host.endsWith("." + domain);
}
module.exports = {
  parseHttpUrl,
  isHostOrSubdomain,
};
