import { Info } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function InfoButton({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label={title} title={title}
          className="h-7 w-7 shrink-0 rounded-full text-muted-foreground">
          <Info className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" collisionPadding={12}
        className="w-96 max-w-[calc(100vw-1.5rem)] p-4 text-sm leading-relaxed text-muted-foreground">
        {children}
      </PopoverContent>
    </Popover>
  );
}
