import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { SubscriptionLogo } from "@/components/SubscriptionLogo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MerchantLogosContext, useMerchantLogo } from "@/contexts/MerchantLogosContext";
import {
  BILL_PROVIDER_CATALOG,
  BILL_PROVIDER_GROUPS,
  providerSearchText,
} from "@/lib/billProviders";
import { dialogDismissHandler } from "@/lib/dialogDismiss";
import { merchantLogoKey } from "@/lib/merchantLogo";
import { publicLogoDomain } from "@/lib/subscriptionLogo";
import { merchantLogosKey, merchantLogosService } from "@/services/merchantLogos";

export function MerchantProviderDialog({
  name,
  month: initialMonth,
  year,
  rowId,
  onClose,
}: {
  name: string;
  month?: string;
  year?: number;
  rowId?: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { userId, choices } = useContext(MerchantLogosContext);
  const [month, setMonth] = useState(initialMonth || "");
  const [scope, setScope] = useState<"from" | "month">("from");
  const startMonth = year ? `${year}-01` : month;
  const saveScope = year ? "year" : scope;
  const periodScoped = !!(year || initialMonth);
  const current = useMerchantLogo(name, { month: startMonth, rowId });
  const currentId = current?.id;
  const currentName = current?.provider_name || "";
  const currentDomain = current?.domain || "";
  const removable = periodScoped
    ? choices.find(
        (choice) =>
          choice.merchant_key === merchantLogoKey(name) &&
          (choice.row_id || "") === (rowId || "") &&
          choice.start_month === startMonth &&
          choice.scope === saveScope,
      )
    : current;
  const [search, setSearch] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const searchResults = useRef<HTMLDivElement>(null);
  const [provider, setProvider] = useState(current?.provider_name || "");
  const [domain, setDomain] = useState(current?.domain || "");
  const [selected, setSelected] = useState(
    current
      ? BILL_PROVIDER_CATALOG.find(
          (provider) =>
            provider.name === current.provider_name && provider.domain === current.domain,
        )?.id || "custom"
      : "",
  );
  useEffect(() => {
    setProvider(currentName);
    setDomain(currentDomain);
    setSelected(
      currentId
        ? BILL_PROVIDER_CATALOG.find(
            (provider) => provider.name === currentName && provider.domain === currentDomain,
          )?.id || "custom"
        : "",
    );
  }, [currentId, currentName, currentDomain, startMonth]);
  const queryClient = useQueryClient();
  const selectedProvider = BILL_PROVIDER_CATALOG.find((provider) => provider.id === selected);
  const terms = providerSearchText(search).split(" ").filter(Boolean);
  const matches = BILL_PROVIDER_CATALOG.filter((provider) => {
    const text = providerSearchText(
      [
        provider.name,
        provider.domain,
        ...provider.regions,
        ...provider.aliases,
        t(`spending_provider_group_${provider.group}`),
      ].join(" "),
    );
    return terms.every((term) => text.includes(term));
  });
  const matchedGroups = BILL_PROVIDER_GROUPS.map((group) => ({
    group,
    providers: matches
      .filter((provider) => provider.group === group)
      .sort((a, b) => a.name.localeCompare(b.name, "tr")),
  }));
  let hostname = "";
  try {
    hostname = publicLogoDomain(
      new URL(domain.includes("://") ? domain : `https://${domain}`).hostname,
    );
  } catch {
    /* An incomplete address cannot be saved. */
  }
  const mutation = useMutation({
    mutationFn: async (action: { type: "save" } | { type: "remove"; id: string }) => {
      if (action.type === "remove") return merchantLogosService.remove(action.id);
      return merchantLogosService.save({
        merchant_name: name,
        provider_name: provider.trim(),
        domain: hostname,
        ...(periodScoped ? { row_id: rowId || "", start_month: startMonth, scope: saveScope } : {}),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: merchantLogosKey(userId) });
      onClose();
    },
  });
  const selectProvider = (value: string) => {
    setSelected(value);
    const found = BILL_PROVIDER_CATALOG.find((provider) => provider.id === value);
    setProvider(found?.name || "");
    setDomain(found?.domain || "");
    setSearch("");
    mutation.reset();
  };
  return (
    <Dialog open onOpenChange={dialogDismissHandler(onClose, mutation.isPending)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t("spending_provider_title")} · {name}
          </DialogTitle>
          <DialogDescription>
            {t(
              year
                ? "spending_provider_year_help"
                : initialMonth
                  ? "spending_provider_period_help"
                  : "spending_provider_help",
              { year },
            )}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (hostname && provider.trim() && (!periodScoped || startMonth) && !mutation.isPending)
              mutation.mutate({ type: "save" });
          }}
        >
          {!year && initialMonth && (
            <div className="space-y-3 rounded-xl border bg-muted/20 p-3">
              <div className="space-y-2">
                <Label htmlFor="bill-provider-month">{t("spending_provider_month")}</Label>
                <Input
                  id="bill-provider-month"
                  type="month"
                  required
                  min="1900-01"
                  max="2199-12"
                  value={month}
                  disabled={mutation.isPending}
                  onChange={(event) => setMonth(event.target.value)}
                />
              </div>
              <fieldset className="space-y-2" disabled={mutation.isPending}>
                <legend className="mb-2 text-sm font-medium">{t("spending_provider_apply")}</legend>
                {(["from", "month"] as const).map((value) => (
                  <label key={value} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="bill-provider-scope"
                      value={value}
                      checked={scope === value}
                      onChange={() => setScope(value)}
                      className="accent-primary"
                    />
                    {t(`spending_provider_scope_${value}`)}
                  </label>
                ))}
              </fieldset>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t(`spending_provider_scope_${scope}_help`)}
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="bill-provider-search">{t("spending_provider_search")}</Label>
            <Input
              ref={searchInput}
              id="bill-provider-search"
              type="search"
              value={search}
              autoComplete="off"
              aria-controls={terms.length ? "bill-provider-results" : undefined}
              placeholder={t("spending_provider_search_placeholder")}
              disabled={mutation.isPending}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (!terms.length || event.nativeEvent.isComposing || mutation.isPending) return;
                if (event.key === "Enter") {
                  event.preventDefault();
                  selectProvider(
                    matchedGroups.flatMap((group) => group.providers)[0]?.id || "custom",
                  );
                } else if (event.key === "ArrowDown") {
                  event.preventDefault();
                  searchResults.current?.querySelector<HTMLButtonElement>("button")?.focus();
                }
              }}
            />
            {terms.length > 0 && (
              <div
                ref={searchResults}
                id="bill-provider-results"
                role="group"
                aria-label={t("spending_provider")}
                className="max-h-64 overflow-y-auto rounded-xl border bg-background p-1"
                onKeyDown={(event) => {
                  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
                  event.preventDefault();
                  const buttons = Array.from(
                    event.currentTarget.querySelectorAll<HTMLButtonElement>("button"),
                  );
                  const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
                  if (event.key === "ArrowUp" && index <= 0) searchInput.current?.focus();
                  else
                    buttons[
                      Math.min(buttons.length - 1, index + (event.key === "ArrowDown" ? 1 : -1))
                    ]?.focus();
                }}
              >
                {matchedGroups.map(
                  ({ group, providers }) =>
                    providers.length > 0 && (
                      <div key={group}>
                        <p className="px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground">
                          {t(`spending_provider_group_${group}`)}
                        </p>
                        {providers.map((provider) => (
                          <button
                            key={provider.id}
                            type="button"
                            disabled={mutation.isPending}
                            aria-pressed={selected === provider.id}
                            onClick={() => selectProvider(provider.id)}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none disabled:opacity-50"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium">{provider.name}</span>
                              {!!provider.regions.length && (
                                <span className="block text-xs text-muted-foreground">
                                  {provider.regions.slice(0, 3).join(", ")}
                                  {provider.regions.length > 3
                                    ? ` +${provider.regions.length - 3}`
                                    : ""}
                                </span>
                              )}
                            </span>
                            {selected === provider.id && (
                              <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                            )}
                          </button>
                        ))}
                      </div>
                    ),
                )}
                {matches.length === 0 && (
                  <p role="status" className="px-3 py-2 text-xs text-muted-foreground">
                    {t("spending_provider_no_results")}
                  </p>
                )}
                <button
                  type="button"
                  disabled={mutation.isPending}
                  onClick={() => selectProvider("custom")}
                  className="mt-1 w-full rounded-lg border-t px-3 py-2 text-left text-sm text-primary hover:bg-muted focus-visible:bg-muted focus-visible:outline-none disabled:opacity-50"
                >
                  {t("spending_provider_custom")}
                </button>
              </div>
            )}
          </div>
          <div className="space-y-2" hidden={terms.length > 0}>
            <Label htmlFor="bill-provider">{t("spending_provider")}</Label>
            <select
              id="bill-provider"
              value={selected}
              disabled={mutation.isPending}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              onChange={(event) => selectProvider(event.target.value)}
            >
              <option value="">{t("spending_provider_choose")}</option>
              {selectedProvider && !matches.includes(selectedProvider) && (
                <option value={selectedProvider.id}>
                  {t("spending_provider_selected")} · {selectedProvider.name}
                </option>
              )}
              {matchedGroups.map(({ group, providers }) => {
                return (
                  providers.length > 0 && (
                    <optgroup key={group} label={t(`spending_provider_group_${group}`)}>
                      {providers.map((provider) => (
                        <option key={provider.id} value={provider.id}>
                          {provider.name}
                          {provider.regions.length
                            ? ` · ${provider.regions.slice(0, 3).join(", ")}${provider.regions.length > 3 ? ` +${provider.regions.length - 3}` : ""}`
                            : ""}
                        </option>
                      ))}
                    </optgroup>
                  )
                );
              })}
              <option value="custom">{t("spending_provider_custom")}</option>
            </select>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("spending_provider_area_help")}
            </p>
            {matches.length === 0 && (
              <p className="text-xs text-muted-foreground">{t("spending_provider_no_results")}</p>
            )}
          </div>
          {selected === "custom" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="bill-provider-name">{t("spending_provider_name")}</Label>
                <Input
                  id="bill-provider-name"
                  value={provider}
                  maxLength={160}
                  disabled={mutation.isPending}
                  onChange={(event) => setProvider(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bill-provider-site">{t("spending_provider_site")}</Label>
                <Input
                  id="bill-provider-site"
                  value={domain}
                  maxLength={500}
                  placeholder="firma.com.tr"
                  disabled={mutation.isPending}
                  onChange={(event) => setDomain(event.target.value)}
                />
              </div>
            </>
          )}
          {hostname && provider.trim() && (
            <div className="flex items-center gap-3 rounded-xl border p-3">
              <SubscriptionLogo
                sub={{ name: provider, url: `https://${hostname}` }}
                className="h-10 w-10 object-contain"
              />
              <div className="min-w-0 space-y-1">
                <span className="block text-sm font-medium">{provider}</span>
                {selectedProvider && (
                  <span className="block text-xs text-muted-foreground">
                    {t(`spending_provider_group_${selectedProvider.group}`)}
                  </span>
                )}
                {!!selectedProvider?.regions.length && (
                  <span className="block max-h-24 overflow-y-auto text-xs leading-relaxed text-muted-foreground">
                    {selectedProvider.regions.join(", ")}
                  </span>
                )}
              </div>
            </div>
          )}
          {mutation.isError && (
            <p role="alert" className="text-sm text-destructive">
              {t("spending_provider_failed")}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={
                !hostname || !provider.trim() || (periodScoped && !startMonth) || mutation.isPending
              }
            >
              {t("finance_save")}
            </Button>
            {removable && (
              <Button
                type="button"
                variant="outline"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate({ type: "remove", id: removable.id })}
              >
                {t(periodScoped ? "spending_provider_period_reset" : "spending_provider_reset")}
              </Button>
            )}
            <Button type="button" variant="ghost" disabled={mutation.isPending} onClick={onClose}>
              {t("cancel")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
