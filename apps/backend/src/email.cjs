// Keep validation bounded and linear, including malformed addresses with many dots.
function isValidEmail(value) {
  if (typeof value !== "string" || !value || value.length > 254) return false;
  const at = value.indexOf("@");
  if (at < 1 || at !== value.lastIndexOf("@")) return false;
  if (/[\s\x00-\x1f\x7f]/.test(value)) return false;
  const domain = value.slice(at + 1);
  const dot = domain.lastIndexOf(".");
  return dot > 0 && dot < domain.length - 1;
}

module.exports = { isValidEmail };
