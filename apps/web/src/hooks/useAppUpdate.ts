import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { compareStableVersions, parseStableVersion } from "@/lib/version";

import manifest from "../../package.json";

interface ReleaseCheck {
  latestVersion: string | null;
  tag: string | null;
  checkedAt: string;
  stale: boolean;
}

export function useAppUpdate() {
  const query = useQuery({
    queryKey: ["app-update"],
    queryFn: ({ signal }) =>
      api.get<ReleaseCheck>("/api/update-check", { signal, cache: "no-store", timeoutMs: 6000 }),
    staleTime: 60 * 60 * 1000,
    refetchInterval: 60 * 60 * 1000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const latest = parseStableVersion(query.data?.latestVersion);
  const current = manifest.version.split("-")[0];
  const comparison = compareStableVersions(query.data?.latestVersion, current);
  if (
    !latest ||
    comparison === null ||
    comparison < 0 ||
    (comparison === 0 && !manifest.version.includes("-"))
  )
    return null;
  const version = latest.join(".");
  const tag = query.data?.tag;
  const releaseTag = tag && parseStableVersion(tag)?.join(".") === version ? tag : `v${version}`;
  return {
    version,
    url: `https://github.com/caglaryalcin/Monline/releases/tag/${encodeURIComponent(releaseTag)}`,
  };
}
