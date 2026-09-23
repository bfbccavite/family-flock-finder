import { cn } from "@/lib/utils";
import logoAsset from "@/assets/BFBC_logo.png.asset.json";

export function ChurchMark({
  abbreviation,
  className,
}: {
  abbreviation: string;
  className?: string;
}) {
  return (
    <img
      src={logoAsset.url}
      alt={`${abbreviation} logo`}
      className={cn("h-11 w-11 shrink-0 object-contain", className)}
    />
  );
}
