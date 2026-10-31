import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { compareReleaseVersions, parseReleaseVersion } from "@/lib/version";

import manifest from "../../package.json";

interface ReleaseCheck {
  latestVersion: string | null;
  tag: string | null;
  checkedAt: string;
  stale: boolean;
}

export function useAppUpdate() {
  const query = useQuery({
    queryKey: ["app-update", manifest.version.includes("-beta.") ? "beta" : "stable"],
    queryFn: ({ signal }) =>
      api.get<ReleaseCheck>("/api/update-check", { signal, cache: "no-store", timeoutMs: 6000 }),
    staleTime: 60 * 60 * 1000,
    refetchInterval: 60 * 60 * 1000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const latest = parseReleaseVersion(query.data?.latestVersion);
  const comparison = compareReleaseVersions(query.data?.latestVersion, manifest.version);
  if (!latest || comparison === null || comparison <= 0) return null;
  const version = latest.version;
  const tag = query.data?.tag;
  const releaseTag = tag && parseReleaseVersion(tag)?.version === version ? tag : `v${version}`;
  return {
    version,
    url: `https://github.com/caglaryalcin/Monline/releases/tag/${encodeURIComponent(releaseTag)}`,
  };
}
