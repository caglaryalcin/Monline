const path = require("node:path");

function betaEnvironment(root, environment) {
  const stableData = path.resolve(root, "apps/backend/monline_data");
  const stableLegacy = path.resolve(root, "apps/backend/pb_data");
  const data = path.resolve(
    root,
    environment.MONLINE_DATA_DIR || "apps/backend/monline_data-beta",
  );
  const legacy = path.resolve(
    root,
    environment.MONLINE_LEGACY_DATA_DIR || "apps/backend/pb_data-beta",
  );
  const overlaps = (a, b) =>
    a === b || a.startsWith(b + path.sep) || b.startsWith(a + path.sep);
  const comparable = (location) =>
    process.platform === "win32" ? location.toLowerCase() : location;
  for (const location of [data, legacy]) {
    if (
      overlaps(comparable(location), comparable(stableData)) ||
      overlaps(comparable(location), comparable(stableLegacy))
    )
      throw new Error(
        "Beta cannot use the main branch's local data directories.",
      );
  }
  return {
    ...environment,
    MONLINE_DATA_DIR: data,
    MONLINE_LEGACY_DATA_DIR: legacy,
  };
}

module.exports = { betaEnvironment };
