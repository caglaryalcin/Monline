import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: React.ReactNode;
  iconClass: string;
  label: string;
  value: string;
  loading: boolean;
}

export function StatCard({ icon, iconClass, label, value, loading }: StatCardProps) {
  return (
    <Card className="min-w-0 shadow-sm border bg-card/40 backdrop-blur-md rounded-3xl overflow-hidden transition-shadow [container-type:inline-size]">
      <CardContent className="monline-calendar-stat flex flex-col items-start gap-2 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
        <div className={cn("rounded-xl p-2 shrink-0 shadow-sm sm:rounded-2xl sm:p-3", iconClass)}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground sm:text-sm">{label}</p>
          {loading ? (
            <div className="mt-1 h-6 w-24 animate-pulse rounded-md bg-muted" />
          ) : (
            <p className="break-words text-[clamp(1rem,9cqi,1.5rem)] font-extrabold tracking-tight text-foreground">
              {value}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
