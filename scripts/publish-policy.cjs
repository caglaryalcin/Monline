const stableVersion = /^1\.(\d+)\.(\d+)$/;
const betaVersion = /^\d+\.\d+\.\d+-beta\.\d+$/;
const validVersion = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function publicationPlan({
  repository,
  ref,
  requestedVersion = "",
  version,
  revision,
  onMain,
  onBeta,
}) {
  if (repository.toLowerCase() !== "caglaryalcin/monline")
    throw new Error("Only the Monline repository may publish these images.");
  if (!validVersion.test(version) || !/^[a-f0-9]{40}$/.test(revision))
    throw new Error(
      "A valid package version and full Git revision are required.",
    );
  const releaseTag =
    requestedVersion || (ref.startsWith("refs/tags/") ? ref.slice(10) : "");
  let channel;
  let tags;
  if (!releaseTag) {
    if (ref !== "refs/heads/beta" || !onBeta)
      throw new Error("Branch image publishing is restricted to beta.");
    channel = "beta";
    tags = ["beta", `beta-${revision.slice(0, 12)}`];
  } else {
    if (releaseTag !== `v${version}`)
      throw new Error("The release tag must match the package version.");
    if (stableVersion.test(version) && onMain) {
      channel = "stable";
      tags = [
        version,
        version.split(".").slice(0, 2).join("."),
        "1",
        releaseTag,
        "latest",
      ];
    } else if (betaVersion.test(version) && onBeta) {
      channel = "beta";
      tags = [version, releaseTag, "beta", `beta-${revision.slice(0, 12)}`];
    } else {
      throw new Error(
        "Stable releases must be 1.x from main; beta releases must use -beta.N from beta.",
      );
    }
  }
  return { channel, tags: [...new Set(tags)] };
}

module.exports = { publicationPlan };
