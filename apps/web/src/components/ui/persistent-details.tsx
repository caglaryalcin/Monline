import type { ComponentPropsWithoutRef } from "react";

import { usePersistentDisclosure } from "@/hooks/usePersistentDisclosure";

type PersistentDetailsProps = Omit<ComponentPropsWithoutRef<"details">, "open" | "onToggle"> & {
  userId?: string;
  preference: string;
  defaultOpen?: boolean;
};

export function PersistentDetails({
  userId,
  preference,
  defaultOpen = false,
  ...props
}: PersistentDetailsProps) {
  const [open, setOpen] = usePersistentDisclosure(userId, preference, defaultOpen);
  return (
    <details {...props} open={open} onToggle={(event) => {
      if (event.currentTarget.open !== open) setOpen(event.currentTarget.open);
    }} />
  );
}
