const urlHost = require("./url-host.js");
function extractImageUrlsFromPage(html, limit) {
  const imageUrls = [];
  const seen = {};
  const addUrl = function (url) {
    if (!url || seen[url] || imageUrls.length >= limit) return;
    seen[url] = true;
    imageUrls.push(url);
  };
  const imgTagRegex = /<img\b[^>]*>/gi;
  const srcRegex = /\bsrc=["']([^"']+)["']/i;
  const classRegex = /\bclass=["']([^"']+)["']/i;

  // Hosts are compared on the parsed hostname, never as substrings: a query
  // string or path can contain a trusted host name while pointing elsewhere.
  const isBlockedSource = function (parsed, lower) {
    if (lower.includes("favicon")) return true;
    if (lower.includes("brave-logo")) return true;
    if (
      lower.includes("/rs:fit:16:") ||
      lower.includes("/rs:fit:24:") ||
      lower.includes("/rs:fit:32:")
    )
      return true;
    if (
      parsed.host === "ssl.gstatic.com" &&
      parsed.path.startsWith("/gb/images")
    )
      return true;
    if (
      (urlHost.isHostOrSubdomain(parsed.host, "wikipedia.org") ||
        urlHost.isHostOrSubdomain(parsed.host, "wikimedia.org")) &&
      parsed.path.startsWith("/wiki/")
    ) {
      return true;
    }
    return false;
  };
  const isImageLike = function (parsed) {
    const hasImageExtension = /\.(png|jpg|jpeg|webp|svg|gif|ico)$/i.test(
      parsed.path,
    );
    const isGoogleThumb =
      parsed.host === "encrypted-tbn0.gstatic.com" &&
      parsed.path === "/images" &&
      parsed.query.toLowerCase().startsWith("q=tbn:");
    const isBraveProxy = parsed.host === "imgs.search.brave.com";
    return hasImageExtension || isGoogleThumb || isBraveProxy;
  };
  const shouldSkipUrl = function (src, className) {
    const lower = src.toLowerCase();
    if (className.includes("favicon")) return true;
    if (lower.startsWith("data:")) return true;
    const parsed = urlHost.parseHttpUrl(
      lower.startsWith("//") ? "https:" + src : src,
    );
    if (!parsed) return true;
    if (isBlockedSource(parsed, lower)) return true;
    return !isImageLike(parsed);
  };
  let imageMatch;
  while (
    (imageMatch = imgTagRegex.exec(html)) !== null &&
    imageUrls.length < limit
  ) {
    const tag = imageMatch[0];
    const srcMatch = srcRegex.exec(tag);
    if (!srcMatch) continue;
    const className = (
      (classRegex.exec(tag) && classRegex.exec(tag)[1]) ||
      ""
    ).toLowerCase();
    /* v8 ignore next -- srcMatch[1] capture group requires [^"']+ so is never empty */
    let src = srcMatch[1] || "";
    if (!src || shouldSkipUrl(src, className)) continue;
    if (src.startsWith("//")) src = "https:" + src;
    addUrl(src);
  }
  if (imageUrls.length < limit) {
    const fallbackPatterns = [
      /https?:\/\/encrypted-tbn0\.gstatic\.com\/images\?q=tbn:[^\s"'<>]+/gi,
      /https?:\/\/imgs\.search\.brave\.com\/[^\s"'<>]+/gi,
      /https?:\/\/[^\s"'<>]+\.(?:png|jpg|jpeg|webp|svg)(?:\?[^\s"'<>]*)?/gi,
    ];
    for (const pattern of fallbackPatterns) {
      let match;
      while (
        (match = pattern.exec(html)) !== null &&
        imageUrls.length < limit
      ) {
        /* v8 ignore next -- match[0] is always truthy when exec() returns non-null */
        const url = String(match[0] || "").replace(/&amp;/g, "&");
        /* v8 ignore next -- url can never be empty here */
        if (!url) continue;
        const parsed = urlHost.parseHttpUrl(url);
        if (!parsed) continue;
        if (isBlockedSource(parsed, url.toLowerCase())) continue;
        if (!isImageLike(parsed)) continue;
        addUrl(url);
      }
    }
  }
  return imageUrls;
}
module.exports = {
  extractImageUrlsFromPage,
};
