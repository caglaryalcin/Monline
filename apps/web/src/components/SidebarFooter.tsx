import { Link } from "@tanstack/react-router";
import { ArrowUpRight, CircleHelp, Github, Info } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAppUpdate } from "@/hooks/useAppUpdate";
import { cn } from "@/lib/utils";

import manifest from "../../package.json";

export function SidebarFooter({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const { t } = useTranslation();
  const update = useAppUpdate();
  const github = "https://github.com/caglaryalcin/Monline";
  return (
    <footer
      className={cn(
        "shrink-0 border-t border-border px-5 py-2 text-muted-foreground",
        collapsed && "lg:hidden",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        {update ? (
          <a
            href={update.url}
            target="_blank"
            rel="noopener noreferrer"
            title={t("app_update_release_notes", { version: update.version })}
            aria-label={t("app_update_release_notes", { version: update.version })}
            className="inline-flex min-w-0 items-center gap-1 rounded-md text-[11px] font-semibold text-primary focus-visible:outline focus-visible:outline-ring"
          >
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="leading-snug tabular-nums">
              {t("app_update_available", { version: update.version })}
            </span>
          </a>
        ) : (
          <span className="text-[11px] tabular-nums">v{manifest.version}</span>
        )}
        <nav aria-label={t("project_links")} className="flex shrink-0 items-center gap-1">
          <a
            href={github}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            title="GitHub"
            className="sidebar-footer-link"
          >
            <Github className="h-4 w-4" aria-hidden="true" />
          </a>
          <a
            href={`${github}/issues/new`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("project_issues")}
            title={t("project_issues")}
            className="sidebar-footer-link"
          >
            <CircleHelp className="h-4 w-4" aria-hidden="true" />
          </a>
          <Link
            to="/about"
            onClick={onNavigate}
            aria-label={t("project_about")}
            title={t("project_about")}
            className="sidebar-footer-link"
          >
            <Info className="h-4 w-4" aria-hidden="true" />
          </Link>
        </nav>
      </div>
    </footer>
  );
}
