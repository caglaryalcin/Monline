import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { displayDateInput } from "@/lib/dateInput";
import { formatCurrency } from "@/lib/utils";

export interface StatementPaymentReviewItem {
  transaction_ids: string[];
  review_token: string;
  subscription_name: string;
  date: string;
  amount: number;
  currency: string;
  candidates: { payment_id: string; date: string; amount: number; currency: string }[];
}
export interface StatementPaymentMatch {
  transaction_ids: string[];
  review_token: string;
  payment_id: string | null;
}
export function readStatementPaymentReviews(error: unknown): StatementPaymentReviewItem[] {
  const response = (error as { response?: { payment_reviews?: unknown } } | null)?.response;
  if (!Array.isArray(response?.payment_reviews)) return [];
  return response.payment_reviews.filter(
    (item): item is StatementPaymentReviewItem =>
      !!item &&
      Array.isArray(item.transaction_ids) &&
      item.transaction_ids.length > 0 &&
      item.transaction_ids.every((id: unknown) => typeof id === "string") &&
      typeof item.review_token === "string" &&
      typeof item.subscription_name === "string" &&
      typeof item.date === "string" &&
      typeof item.amount === "number" &&
      typeof item.currency === "string" &&
      Array.isArray(item.candidates) &&
      item.candidates.length > 0 &&
      item.candidates.every(
        (candidate: StatementPaymentReviewItem["candidates"][number]) =>
          !!candidate &&
          typeof candidate.payment_id === "string" &&
          typeof candidate.date === "string" &&
          typeof candidate.amount === "number" &&
          typeof candidate.currency === "string",
      ),
  );
}

export function StatementPaymentReview({
  reviews,
  busy,
  onBack,
  onConfirm,
}: {
  reviews: StatementPaymentReviewItem[];
  busy: boolean;
  onBack: () => void;
  onConfirm: (matches: StatementPaymentMatch[]) => void;
}) {
  const { t } = useTranslation();
  const inputId = useId();
  const [choices, setChoices] = useState<Record<string, string>>({});
  const keyFor = (review: StatementPaymentReviewItem) => JSON.stringify(review.transaction_ids);
  const complete = reviews.every((review) => !!choices[keyFor(review)]);
  const payments = reviews
    .map((review) => choices[keyFor(review)])
    .filter((choice) => choice && choice !== "new");
  const reused = new Set(payments).size !== payments.length;
  const money = (amount: number, currency: string) => formatCurrency(amount, currency, {});
  return (
    <section className="space-y-4" aria-label={t("statement_payment_review_title")}>
      <div
        role="alert"
        className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4"
      >
        <h3 className="font-semibold">{t("statement_payment_review_title")}</h3>
        <p className="text-sm text-muted-foreground">{t("statement_payment_review_help")}</p>
      </div>
      {reviews.map((review, index) => {
        const key = keyFor(review);
        return (
          <fieldset key={key} disabled={busy} className="min-w-0 space-y-3 rounded-xl border p-4">
            <legend className="px-1 font-semibold">{review.subscription_name}</legend>
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="text-muted-foreground">
                {t("statement_payment_review_statement")}
              </span>
              <span className="font-medium tabular-nums">
                {displayDateInput(review.date)} · {money(review.amount, review.currency)}
              </span>
            </div>
            <p className="text-sm font-medium">{t("statement_payment_review_question")}</p>
            <div className="space-y-2">
              {review.candidates.map((candidate) => (
                <label
                  key={candidate.payment_id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <input
                    type="radio"
                    name={`${inputId}-${index}`}
                    value={candidate.payment_id}
                    className="mt-0.5 accent-primary"
                    checked={choices[key] === candidate.payment_id}
                    onChange={() =>
                      setChoices((current) => ({ ...current, [key]: candidate.payment_id }))
                    }
                  />
                  <span className="min-w-0 space-y-1">
                    <span className="block font-medium">{t("statement_payment_review_same")}</span>
                    <span className="block tabular-nums text-muted-foreground">
                      {displayDateInput(candidate.date)} ·{" "}
                      {money(candidate.amount, candidate.currency)}
                    </span>
                    {Math.abs(review.amount - candidate.amount) >= 0.005 && (
                      <span className="block text-xs text-amber-700 dark:text-amber-400">
                        {t("statement_payment_review_amount_diff")}
                      </span>
                    )}
                  </span>
                </label>
              ))}
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                <input
                  type="radio"
                  name={`${inputId}-${index}`}
                  value="new"
                  className="mt-0.5 accent-primary"
                  checked={choices[key] === "new"}
                  onChange={() => setChoices((current) => ({ ...current, [key]: "new" }))}
                />
                <span>{t("statement_payment_review_separate")}</span>
              </label>
            </div>
          </fieldset>
        );
      })}
      {!complete && (
        <p role="status" className="text-sm text-muted-foreground">
          {t("statement_payment_review_required")}
        </p>
      )}
      {reused && (
        <p role="alert" className="text-sm text-destructive">
          {t("statement_import_payment_reused")}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" disabled={busy} onClick={onBack}>
          {t("statement_payment_review_back")}
        </Button>
        <Button
          type="button"
          disabled={busy || !complete || reused}
          onClick={() =>
            onConfirm(
              reviews.map((review) => ({
                transaction_ids: review.transaction_ids,
                review_token: review.review_token,
                payment_id: choices[keyFor(review)] === "new" ? null : choices[keyFor(review)],
              })),
            )
          }
        >
          {t("statement_payment_review_confirm")}
        </Button>
      </div>
    </section>
  );
}
