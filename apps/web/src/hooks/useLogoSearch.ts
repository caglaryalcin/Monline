import type { ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { api } from "@/lib/api";
import { findLogoService, normalizeLogoName } from "@/lib/logoServices";
import { publicLogoDomain } from "@/lib/subscriptionLogo";

export type LogoResult = {
  previewUrl: string;
  file: File;
  source: string;
  contentType: string;
};

export function useLogoSearch(automaticName = "", hasSavedLogo = false) {
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [logoSearch, setLogoSearch] = useState("");
  const [logoResults, setLogoResults] = useState<LogoResult[]>([]);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [showLogoResults, setShowLogoResults] = useState(false);
  const logoSearchRef = useRef<HTMLDivElement>(null);
  const selectionOrigin = useRef<"automatic" | "manual" | null>(null);
  const selectedFile = useRef<File | null>(null);
  const automaticFor = useRef("");
  const automaticLookup = useRef<{ query: string; run: () => Promise<LogoResult | null> } | null>(
    null,
  );
  const automatic = !logoSearch.trim();
  const query = logoSearch.trim() || automaticName.trim();
  const currentSelection =
    selectionOrigin.current !== "automatic" || automaticFor.current === automaticName.trim();

  // ── Logo search effect ─────────────────────────────────────────────────────
  useEffect(() => {
    if (query.length < 2 || (automatic && (hasSavedLogo || selectionOrigin.current === "manual"))) {
      automaticLookup.current = null;
      setLogoResults([]);
      setShowLogoResults(false);
      setSearching(false);
      return;
    }

    let cancelled = false;
    const abort = new AbortController();
    const previewUrls = new Set<string>();
    const deadline = window.setTimeout(() => abort.abort(), automatic ? 8000 : 15000);
    let chosen: LogoResult | null = null;
    setLogoResults([]);
    if (automatic) setShowLogoResults(false);

    const fetchWithTimeout = async (url: string) => {
      const controller = new AbortController();
      /* v8 ignore next */
      const timeout = window.setTimeout(() => controller.abort(), 3500);
      try {
        try {
          return await fetch(url, {
            signal: AbortSignal.any([controller.signal, abort.signal]),
            referrerPolicy: "no-referrer",
          });
        } catch {
          if (cancelled || abort.signal.aborted) throw new Error("Search cancelled");
          const result = await api.get<{ contentType: string; base64: string }>(
            `/api/logo_fetch?url=${encodeURIComponent(url)}`,
            { signal: AbortSignal.any([abort.signal, AbortSignal.timeout(8000)]) },
          );
          return new Response(
            Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0)),
            { headers: { "content-type": result.contentType } },
          );
        }
      } finally {
        window.clearTimeout(timeout);
      }
    };

    const probeImage = async (url: string, key: string): Promise<LogoResult | null> => {
      try {
        const res = await fetchWithTimeout(url);
        /* v8 ignore next */
        if (!res.ok) return null;

        /* v8 ignore next 3 */
        const contentType = (res.headers.get("content-type") || "").toLowerCase();
        /* v8 ignore next */
        if (!contentType.startsWith("image/")) return null;
        const blob = await res.blob();
        if (cancelled || blob.size > 2 * 1024 * 1024) return null;
        if (blob.size < (contentType.includes("svg") ? 16 : 64)) return null;

        /* v8 ignore next */
        const type = (contentType || blob.type || "image/png").split(";")[0];

        if (!type.includes("svg")) {
          try {
            const bitmap = await createImageBitmap(blob);
            const tooSmall = bitmap.width < 16 || bitmap.height < 16;
            bitmap.close();
            /* v8 ignore next */
            if (tooSmall) return null;
          } catch {
            // Cannot check dimensions — accept
          }
        }

        /* v8 ignore next */
        const extRaw = type.split("/")[1] || "png";
        const ext = type.includes("icon") ? "ico" : extRaw.replace("svg+xml", "svg");
        const file = new File([blob], `logo-${key}.${ext}`, { type });
        if (cancelled) return null;
        const previewUrl = URL.createObjectURL(blob);
        previewUrls.add(previewUrl);
        return { previewUrl, file, source: url, contentType: type };
      } catch {
        return null;
      }
    };

    const collectLogos = async () => {
      setSearching(true);
      if (!automatic) setShowLogoResults(true);

      const normalized = query
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

      const words = normalized.split(/\s+/).filter(Boolean);
      const compact = normalizeLogoName(query);
      const service = findLogoService(query);
      const chooseAutomatic = (result: LogoResult | null) => {
        if (!result || !automatic || chosen || cancelled || selectionOrigin.current === "manual")
          return;
        chosen = result;
        selectionOrigin.current = "automatic";
        automaticFor.current = query;
        selectedFile.current = result.file;
        setLogoFile(result.file);
        setLogoUrl(result.source);
        setLogoPreview(URL.createObjectURL(result.file));
      };
      const bundled = service?.logoUrl ? await probeImage(service.logoUrl, service.iconSlug) : null;
      if (automatic && bundled) {
        chooseAutomatic(bundled);
        setLogoResults([bundled]);
        return bundled;
      }
      // Do not make an unknown brand wait for company-name discovery first.
      const brandLookup =
        automatic && !service
          ? probeImage(`https://cdn.simpleicons.org/${encodeURIComponent(compact)}`, compact).then(
              (result) => {
                chooseAutomatic(result);
                return result;
              },
            )
          : Promise.resolve(null);

      const buildDomainCandidates = async () => {
        // Known platforms should not wait for a company autocomplete service.
        const known = service?.domain || publicLogoDomain(query);
        if (known) return [known];
        const domainSet = new Set<string>();

        try {
          const suggestRes = await fetch(
            `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(query)}`,
            { signal: AbortSignal.any([abort.signal, AbortSignal.timeout(2000)]) },
          );
          if (suggestRes.ok) {
            const companies = (await suggestRes.json()) as Array<{
              name?: string | null;
              domain?: string | null;
            }>;
            /* v8 ignore next */
            (companies || []).forEach((company) => {
              /* v8 ignore next */
              const domain = (company?.domain || "").trim().toLowerCase();
              // An automatic choice must match the name, not a different
              // company returned by a broad autocomplete search.
              if (automatic && normalizeLogoName(company?.name || "") !== compact) return;
              if (publicLogoDomain(domain)) domainSet.add(domain);
            });
          }
        } catch (_) {
          // Logo URL extraction is best-effort; ignore failures
        }

        /* v8 ignore next 3 */
        const results =
          domainSet.size === 0 && compact && !automatic
            ? [publicLogoDomain(`${compact}.com`)].filter(Boolean)
            : Array.from(domainSet).slice(0, 4);

        return results;
      };

      const domainSources = [
        (d: string) => `https://icon.horse/icon/${encodeURIComponent(d)}`,
        (d: string) => `https://unavatar.io/${encodeURIComponent(d)}?fallback=false`,
      ];

      const domains = await buildDomainCandidates();

      const slugCandidates = Array.from(
        new Set([
          ...(service ? [service.iconSlug] : []),
          compact,
          ...(!automatic ? [words.join(""), words.join("-"), ...words] : []),
        ]),
      )
        .filter((s) => s.length >= 2)
        .slice(0, 4);

      type Candidate = { url: string; key: string };
      const allCandidates: Candidate[] = [];
      for (const domain of domains) {
        for (const src of domainSources) {
          allCandidates.push({ url: src(domain), key: domain });
        }
      }
      for (const slug of slugCandidates) {
        if (automatic && !service && slug === compact) continue;
        allCandidates.push({
          url: `https://cdn.simpleicons.org/${encodeURIComponent(slug)}`,
          key: slug,
        });
      }

      const seen = new Set<string>();
      const unique = allCandidates.filter(({ url }) => {
        /* v8 ignore next */
        if (seen.has(url)) return false;
        seen.add(url);
        return true;
      });

      const BATCH = 4;
      const brand = await brandLookup;
      const results: LogoResult[] = [...(bundled ? [bundled] : []), ...(brand ? [brand] : [])];
      if (!cancelled && brand) setLogoResults([brand]);

      for (let i = 0; i < unique.length; i += BATCH) {
        /* v8 ignore next */
        if (cancelled || abort.signal.aborted) break;
        const batch = unique.slice(i, i + BATCH);
        const settled = await Promise.allSettled(
          batch.map(({ url, key }) =>
            probeImage(url, key).then((result) => {
              chooseAutomatic(result);
              return result;
            }),
          ),
        );
        for (const r of settled) {
          /* v8 ignore next */
          if (r.status === "fulfilled" && r.value) results.push(r.value);
        }
        if (!cancelled) {
          setLogoResults(results.slice(0, 15));
          chooseAutomatic(results[0] ?? null);
        }
        /* v8 ignore next */
        if (results.length >= 15) break;
      }

      const sorted = results.sort((a, b) => {
        const priority = (type: string) => {
          if (type.includes("png")) return 0;
          if (type.includes("svg")) return 1;
          if (type.includes("jpeg") || type.includes("jpg")) return 2;
          if (type.includes("webp")) return 3;
          return 4;
        };
        return priority(a.contentType) - priority(b.contentType);
      });

      if (cancelled) {
        sorted.forEach((logo) => URL.revokeObjectURL(logo.previewUrl));
        return null;
      }

      sorted.slice(15).forEach((logo) => {
        URL.revokeObjectURL(logo.previewUrl);
        previewUrls.delete(logo.previewUrl);
      });
      setLogoResults(sorted.slice(0, 15));
      return chosen ?? sorted[0] ?? null;
    };

    let pending: Promise<LogoResult | null> | null = null;
    const run = () => {
      if (cancelled || abort.signal.aborted) return Promise.resolve(null);
      if (pending) return pending;
      pending = collectLogos()
        .catch((): null => {
          if (!cancelled) setLogoResults([]);
          return null;
        })
        .finally(() => {
          window.clearTimeout(deadline);
          if (!cancelled) setSearching(false);
        });
      return pending;
    };
    const lookup = { query, run };
    if (automatic) automaticLookup.current = lookup;
    else automaticLookup.current = null;
    const timeoutId = window.setTimeout(
      () => {
        void run();
      },
      automatic ? 500 : 350,
    );

    return () => {
      cancelled = true;
      abort.abort();
      window.clearTimeout(timeoutId);
      window.clearTimeout(deadline);
      if (automaticLookup.current === lookup) automaticLookup.current = null;
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [query, automatic, hasSavedLogo]);

  // ── Click-outside closes results panel ────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (logoSearchRef.current && !logoSearchRef.current.contains(event.target as Node)) {
        setShowLogoResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Revoke preview URL on preview change ─────────────────────────────────
  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  const handleSelectLogo = (result: LogoResult) => {
    selectionOrigin.current = "manual";
    selectedFile.current = result.file;
    setLogoFile(result.file);
    // The selected preview owns its URL independently from disposable search results.
    setLogoPreview(URL.createObjectURL(result.file));
    setLogoUrl(result.source);
    setShowLogoResults(false);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    selectionOrigin.current = file ? "manual" : null;
    selectedFile.current = file;
    if (file) {
      setLogoPreview(URL.createObjectURL(file));
    } else {
      setLogoPreview(null);
    }
    setLogoFile(file);
    setLogoUrl("");
    setShowLogoResults(false);
  };

  async function resolveLogoFile(name: string): Promise<File | null> {
    if (selectionOrigin.current === "manual") return selectedFile.current;
    if (hasSavedLogo) return null;
    if (automaticFor.current === name.trim() && selectedFile.current) return selectedFile.current;
    const lookup = automaticLookup.current;
    // Reuse the debounced request if Save was pressed before lookup finished.
    if (lookup?.query === name.trim()) return (await lookup.run())?.file ?? null;
    return null;
  }

  return {
    logoFile: currentSelection ? logoFile : null,
    logoUrl: currentSelection ? logoUrl : "",
    logoSearch,
    setLogoSearch,
    logoResults,
    logoPreview: currentSelection ? logoPreview : null,
    searching,
    showLogoResults,
    setShowLogoResults,
    logoSearchRef,
    handleSelectLogo,
    handleFileChange,
    resolveLogoFile,
    manualLogo: selectionOrigin.current === "manual",
  };
}
