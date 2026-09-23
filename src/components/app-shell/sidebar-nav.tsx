import { Link, useRouterState } from "@tanstack/react-router";
import { NAV_SECTIONS } from "@/lib/nav";
import { can, type Role } from "@/lib/roles";
import { cn } from "@/lib/utils";

export function SidebarNav({
  role,
  onNavigate,
}: {
  role: Role | null;
  onNavigate?: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="flex flex-col gap-6 px-3 py-5" aria-label="Main navigation">
      {NAV_SECTIONS.map((section) => {
        const items = section.items.filter((item) => !item.capability || can(role, item.capability));
        if (items.length === 0) return null;

        return (
          <div key={section.heading} className="flex flex-col gap-1">
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-widest text-sidebar-foreground/45">
              {section.heading}
            </p>
            {items.map((item) => {
              const active =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);
              const Icon = item.icon;

              if (item.comingSoon) {
                return (
                  <span
                    key={item.href}
                    className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/35"
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {item.label}
                    <span className="ml-auto text-[10px] uppercase tracking-wide">Soon</span>
                  </span>
                );
              }

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border-l-2 border-transparent px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "border-sidebar-primary bg-sidebar-accent text-sidebar-primary"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
