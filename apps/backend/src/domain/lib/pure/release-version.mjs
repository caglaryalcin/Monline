/** Release formats supported by Monline's stable and beta publishing channels. */
export function parseReleaseVersion(value) {
  if (typeof value !== "string") return null;
  const match =
    /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-beta\.(0|[1-9]\d*))?$/.exec(
      value,
    );
  if (!match) return null;
  const core = [Number(match[1]), Number(match[2]), Number(match[3])];
  const beta = match[4] === undefined ? null : Number(match[4]);
  if (
    !core.every(Number.isSafeInteger) ||
    (beta !== null && !Number.isSafeInteger(beta))
  )
    return null;
  return {
    core,
    beta,
    version: core.join(".") + (beta === null ? "" : `-beta.${beta}`),
  };
}

export function compareReleaseVersions(left, right) {
  const a = parseReleaseVersion(left);
  const b = parseReleaseVersion(right);
  if (!a || !b) return null;
  for (let index = 0; index < 3; index++) {
    if (a.core[index] > b.core[index]) return 1;
    if (a.core[index] < b.core[index]) return -1;
  }
  if (a.beta === b.beta) return 0;
  // A final release follows every beta of the same major/minor/patch version.
  if (a.beta === null) return 1;
  if (b.beta === null) return -1;
  return a.beta > b.beta ? 1 : -1;
}
