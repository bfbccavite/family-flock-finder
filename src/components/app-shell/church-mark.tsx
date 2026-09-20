import { cn } from "@/lib/utils";

export function ChurchMark({
  abbreviation,
  className,
}: {
  abbreviation: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold tracking-tight text-primary-foreground",
        className,
      )}
      aria-hidden="true"
    >
      {abbreviation.slice(0, 4)}
    </span>
  );
}
