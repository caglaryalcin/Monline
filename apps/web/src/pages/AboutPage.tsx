import { CircleHelp, ExternalLink, Github } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";

import { LogoIcon } from "@/components/AppLogo";
import { Card, CardContent } from "@/components/ui/card";

import manifest from "../../package.json";

const github = "https://github.com/caglaryalcin/Monline";

export function AboutPage() {
  const { t } = useTranslation();

  return (
    <section aria-label={t("project_about")} className="mx-auto w-full max-w-3xl space-y-6">
      <header className="flex items-center gap-4">
        <LogoIcon className="h-12 w-12" />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Monline</h1>
          <p className="mt-1 text-sm text-muted-foreground">v{manifest.version}</p>
        </div>
      </header>

      <Card className="rounded-3xl">
        <CardContent className="space-y-6 p-5 leading-relaxed sm:p-7">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">{t("project_about")}</h2>
            <p className="text-sm">{t("project_about_description")}</p>
            <p className="text-sm text-muted-foreground">
              <Trans i18nKey="project_stack" components={{ label: <strong /> }} />
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-5 text-sm">
            <span className="text-muted-foreground">{t("project_maintainer")}</span>
            <a
              href="https://github.com/caglaryalcin"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md font-semibold text-primary focus-visible:outline focus-visible:outline-ring"
            >
              <Github className="h-4 w-4" aria-hidden="true" />
              caglaryalcin
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a
              href={github}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-ring"
            >
              <Github className="h-4 w-4" aria-hidden="true" />
              GitHub
            </a>
            <a
              href={`${github}/issues/new`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-ring"
            >
              <CircleHelp className="h-4 w-4" aria-hidden="true" />
              {t("project_issues")}
            </a>
          </div>

          <p className="border-t pt-5 text-xs text-muted-foreground">
            © 2026 {manifest.author.name} ·{" "}
            <a
              href={`${github}/blob/main/LICENSE`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-sm underline underline-offset-2 focus-visible:outline focus-visible:outline-ring"
            >
              {manifest.license}
            </a>
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
