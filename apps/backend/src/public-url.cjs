// Each installation owns its public address. There is deliberately no default host.
// A process-level override is useful when a local checkout uses restored settings.
function publicUrl(repository, pathname = "", fallback = "") {
  const configured =
    process.env.MONLINE_PUBLIC_URL ||
    repository
      .findRecordsByFilter("admin_settings", "", "", 1)[0]
      ?.getString("server_url") ||
    fallback;
  try {
    const url = new URL(configured);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    url.pathname = url.pathname.replace(/\/+$/, "") + pathname;
    url.search = "";
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

module.exports = { publicUrl };
