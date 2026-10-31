const { httpClient } = require("../../runtime.cjs");
const { version: currentVersion } = require("../../../package.json");
const {
  parseReleaseVersion,
  compareReleaseVersions,
} = require("./pure/release-version.mjs");
function repository() {
  return "caglaryalcin/Monline";
}
async function checkUpdates(app) {
  const betaChannel = parseReleaseVersion(currentVersion)?.beta != null;
  var key =
    "monline.official-release-check." + (betaChannel ? "beta" : "stable");
  var now = Date.now();
  var cached = null;
  // Cache the verified release response for every request.
  try {
    cached = JSON.parse(app.store().get(key) || "null");
  } catch (_) {}
  if (cached && cached.expiresAt > now) return cached.value;
  try {
    var response = await httpClient.send({
      url:
        "https://api.github.com/repos/" +
        repository() +
        (betaChannel ? "/releases?per_page=100" : "/releases/latest"),
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "Monline-update-check",
      },
      timeout: 4,
      maxBytes: 1024 * 1024,
    });
    if (
      response.statusCode !== 200 ||
      (response.raw && response.raw.length > 1024 * 1024)
    )
      throw new Error("Release service unavailable");
    const releases = betaChannel ? response.json : [response.json];
    if (!Array.isArray(releases)) throw new Error("Invalid release response");
    var release = releases
      .filter((candidate) => {
        const parsed = parseReleaseVersion(candidate?.tag_name);
        return (
          parsed &&
          !candidate.draft &&
          (parsed.beta === null
            ? !candidate.prerelease
            : betaChannel && candidate.prerelease)
        );
      })
      .sort((a, b) => compareReleaseVersions(b.tag_name, a.tag_name))[0];
    var version = parseReleaseVersion(release?.tag_name)?.version;
    if (!version) throw new Error("No release for this channel");
    var completedAt = Date.now();
    var value = {
      latestVersion: version,
      tag: release.tag_name,
      checkedAt: new Date(completedAt).toISOString(),
      stale: false,
    };
    app.store().set(
      key,
      JSON.stringify({
        value: value,
        expiresAt: completedAt + 60 * 60 * 1000,
        lastSuccessAt: completedAt,
      }),
    );

    // Retain the legacy admin status without making sidebar checks opt-in.
    try {
      var settings = app.findRecordsByFilter("admin_settings", "", "", 1, 0);
      if (
        settings.length &&
        settings[0].getString("latest_version") !== release.tag_name
      ) {
        settings[0].set("latest_version", release.tag_name);
        app.save(settings[0]);
      }
    } catch (_) {}
    return value;
  } catch (_) {
    var failedAt = Date.now();
    var keepPrevious =
      cached && cached.lastSuccessAt > failedAt - 24 * 60 * 60 * 1000;
    var fallback = keepPrevious
      ? {
          latestVersion: cached.value.latestVersion,
          tag: cached.value.tag,
          checkedAt: cached.value.checkedAt,
          stale: true,
        }
      : {
          latestVersion: null,
          tag: null,
          checkedAt: new Date(failedAt).toISOString(),
          stale: true,
        };
    app.store().set(
      key,
      JSON.stringify({
        value: fallback,
        expiresAt: failedAt + 15 * 60 * 1000,
        lastSuccessAt: keepPrevious ? cached.lastSuccessAt : 0,
      }),
    );
    return fallback;
  }
}
module.exports = {
  repository,
  checkUpdates,
};
