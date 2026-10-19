const { files, httpClient, routerAdd } = require("../runtime.cjs");
const domainPath = __dirname;
// ================================================================
// ROUTE: Logo Search
// ================================================================
routerAdd("GET", "/api/logo_search", async (e) => {
  const logoUtils = require(domainPath + "/lib/pure/logo-utils.js");
  const { getQueryParam } = require(domainPath + "/lib/pure/request-query.js");
  try {
    if (!e.auth) {
      return e.json(403, {
        error: "Authentication required",
      });
    }
    const search = getQueryParam(e, "search");
    if (!search) {
      return e.json(400, {
        error: "Missing 'search' parameter",
      });
    }
    const encodedQuery = encodeURIComponent(search + " logo");
    const maxResults = 24;
    let logos = [];
    const googleUrl =
      "https://www.google.com/search?q=" + encodedQuery + "&tbm=isch";
    const braveUrl = "https://search.brave.com/search?q=" + encodedQuery;
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Encoding": "identity",
    };
    try {
      const res = await httpClient.send({
        url: googleUrl,
        method: "GET",
        headers,
      });
      if (res.statusCode === 200 && res.raw) {
        logos = logoUtils.extractImageUrlsFromPage(res.raw, maxResults);
      }
    } catch (_) {}
    if (logos.length === 0) {
      try {
        const res = await httpClient.send({
          url:
            "https://search.brave.com/images?q=" + encodedQuery + "&source=web",
          method: "GET",
          headers,
        });
        if (res.statusCode === 200 && res.raw) {
          logos = logoUtils.extractImageUrlsFromPage(res.raw, maxResults);
        }
      } catch (_) {}
    }
    return e.json(200, {
      logos: logos,
    });
  } catch (_) {
    return e.json(200, {
      logos: [],
    });
  }
});
routerAdd("GET", "/api/logo_fetch", async (e) => {
  const { getQueryParam } = require(domainPath + "/lib/pure/request-query.js");
  const images = require(domainPath + "/lib/pure/image-source.js");
  try {
    if (!e.auth) {
      return e.json(403, {
        error: "Authentication required",
      });
    }
    const url = getQueryParam(e, "url");
    if (!images.allowedLogoUrl(url)) {
      return e.json(400, {
        error: "Invalid 'url' parameter",
      });
    }
    const image = await files.fileFromURL(url, 8);
    const bytes = image.reader.bytes;
    if (!bytes || !bytes.length || bytes.length > 2 * 1024 * 1024) {
      return e.json(400, {
        error: "Unable to fetch image",
      });
    }
    const contentType = images.imageContentType(bytes);
    if (!contentType)
      return e.json(400, {
        error: "Not an image",
      });
    const base64 = images.toBase64(bytes);
    e.response.header().set("Cache-Control", "no-store");
    return e.json(200, {
      contentType,
      base64,
    });
  } catch (err) {
    return e.json(400, {
      error: "Failed to fetch image",
    });
  }
});
