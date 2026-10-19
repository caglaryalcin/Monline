import { PaymentMethodLogo } from "@/components/PaymentMethodLogo";
import type { PaymentMethod } from "@/types";

export function PaymentMethodIcon({ method, size = 40 }: { method: PaymentMethod; size?: number }) {
  return <PaymentMethodLogo method={method} size={size} className="rounded-lg text-xs" />;
}
