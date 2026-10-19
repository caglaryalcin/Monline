interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}

export function InfoRow({ icon, label, children }: InfoRowProps) {
  return (
    <div className="grid min-w-0 grid-cols-[1rem_minmax(0,1fr)] items-start gap-x-2 gap-y-1 text-sm sm:flex sm:gap-2">
      <span className="mt-px text-muted-foreground shrink-0">{icon}</span>
      <span className="shrink-0 text-muted-foreground sm:w-28">{label}</span>
      <span className="col-start-2 min-w-0 break-words font-medium leading-snug">{children}</span>
    </div>
  );
}
