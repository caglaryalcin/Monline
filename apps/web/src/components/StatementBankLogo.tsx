import { FileText } from "lucide-react";
import { useState } from "react";

import type { StatementBank } from "@/lib/statements";
import { cn } from "@/lib/utils";

// Bundled from the banks' official website header logos. The PDF itself stays
// on the user's device; its detected bank selects the corresponding asset.
const BANK_LOGOS: Record<StatementBank, string> = {
  enpara: "/assets/logos/banks/enpara.svg",
  denizbank: "/assets/logos/banks/denizbank.svg",
  garanti: "/assets/logos/banks/garanti.svg",
};

export function StatementBankLogo({ bank }: { bank: StatementBank | "" }) {
  const [failedSource, setFailedSource] = useState("");
  const source = bank ? BANK_LOGOS[bank] : undefined;
  const showLogo = typeof source === "string" && source !== failedSource;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-11 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border p-2",
        showLogo ? "border-black/10 bg-white" : "border-border bg-muted/20 text-primary",
      )}
    >
      {showLogo ? (
        <img
          src={source}
          alt=""
          width={64}
          height={28}
          className="h-full w-full object-contain"
          loading="lazy"
          draggable={false}
          onError={() => setFailedSource(source)}
        />
      ) : (
        <FileText className="h-5 w-5" />
      )}
    </span>
  );
}
