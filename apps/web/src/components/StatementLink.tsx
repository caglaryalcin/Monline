import { type AnchorHTMLAttributes, forwardRef } from "react";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "target" | "rel"> & {
  statementId: string;
};

// Warm the module cache before navigating to the statement in the current tab.
// Loading failure never prevents the ordinary browser link from working.
function preloadStatementPage() {
  void import("@/pages/StatementsPage").catch(() => {});
}

export const StatementLink = forwardRef<HTMLAnchorElement, Props>(function StatementLink(
  { statementId, onMouseEnter, onFocus, ...props },
  ref,
) {
  return (
    <a
      {...props}
      ref={ref}
      href={`/statements/${statementId}`}
      onMouseEnter={(event) => {
        onMouseEnter?.(event);
        preloadStatementPage();
      }}
      onFocus={(event) => {
        onFocus?.(event);
        preloadStatementPage();
      }}
    />
  );
});
