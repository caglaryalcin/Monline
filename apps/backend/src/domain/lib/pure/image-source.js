const { parseHttpUrl } = require("./url-host.js");
const { toBase64 } = require("./base64.js");
const HOSTS = [
  "icon.horse",
  "cdn.simpleicons.org",
  "unavatar.io",
  "cdn.brandfetch.io",
  "img.logo.dev",
  "logo.clearbit.com",
];
function allowedLogoUrl(url) {
  const parsed = parseHttpUrl(url);
  return (
    !!parsed &&
    /^https:\/\/[a-z0-9.-]+\//i.test(url) &&
    HOSTS.indexOf(parsed.host) >= 0
  );
}
function imageContentType(bytes) {
  if (
    bytes.length >= 8 &&
    bytes[0] === 137 &&
    bytes[1] === 80 &&
    bytes[2] === 78 &&
    bytes[3] === 71 &&
    bytes[4] === 13 &&
    bytes[5] === 10 &&
    bytes[6] === 26 &&
    bytes[7] === 10
  )
    return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return "image/jpeg";
  const head = Array.prototype.slice
    .call(bytes, 0, 512)
    .map((byte) => String.fromCharCode(byte))
    .join("");
  if (/^GIF8[79]a/.test(head)) return "image/gif";
  if (head.slice(0, 4) === "RIFF" && head.slice(8, 12) === "WEBP")
    return "image/webp";
  if (bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0)
    return "image/x-icon";
  if (/^\s*(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(head)) return "image/svg+xml";
  return null;
}
module.exports = {
  allowedLogoUrl,
  imageContentType,
  toBase64,
};
