import { cn } from "@/lib/utils";


export function ChurchMark({
  abbreviation,
  className,
}: {
  abbreviation: string;
  className?: string;
}) {
  return (
    <img
      src="/bfbc-logo.png"
      alt={`${abbreviation} logo`}
      className={cn("h-11 w-11 shrink-0 object-contain", className)}
    />
  );
}
