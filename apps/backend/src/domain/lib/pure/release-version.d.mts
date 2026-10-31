export interface ReleaseVersion {
  core: readonly number[];
  beta: number | null;
  version: string;
}

export function parseReleaseVersion(value: unknown): ReleaseVersion | null;
export function compareReleaseVersions(
  left: unknown,
  right: unknown,
): -1 | 0 | 1 | null;
