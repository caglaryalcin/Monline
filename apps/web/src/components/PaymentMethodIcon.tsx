import { PaymentMethodLogo } from "@/components/PaymentMethodLogo";
import { paymentMethodLogoSources } from "@/lib/paymentMethodLogos";
import type { PaymentMethod } from "@/types";

export function getPaymentIconSrc(method: PaymentMethod): string | null {
  return paymentMethodLogoSources(method)[0] ?? null;
}

export function PaymentMethodIcon({ method }: { method: PaymentMethod }) {
  return <PaymentMethodLogo method={method} className="h-7 w-10 rounded text-[10px]" />;
}
