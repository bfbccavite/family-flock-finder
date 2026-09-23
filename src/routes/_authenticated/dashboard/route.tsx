import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useChurchSettings, useStaffProfile } from "@/lib/church-data";
import { SidebarNav } from "@/components/app-shell/sidebar-nav";
import { AppHeader } from "@/components/app-shell/app-header";
import { ChurchMark } from "@/components/app-shell/church-mark";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  const navigate = useNavigate();
  const { data: profile, isLoading } = useStaffProfile();
  const { data: settings } = useChurchSettings();

  useEffect(() => {
    if (!isLoading && profile && !profile.active) {
      navigate({ to: "/inactive", replace: true });
    }
  }, [isLoading, profile, navigate]);

  if (isLoading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const churchName = settings?.church_name ?? "Bethel Fundamental Baptist Church";
  const abbreviation = settings?.abbreviation ?? "BFBC";

  return (
    <div className="flex min-h-screen bg-muted/35">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex h-20 items-center gap-3 border-b border-sidebar-border px-5">
          <ChurchMark abbreviation={abbreviation} className="h-12 w-12" />
          <div className="leading-tight">
            <p className="font-display text-base font-bold text-sidebar-foreground">{abbreviation}</p>
            <p className="text-xs text-sidebar-foreground/55">Church Management</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav role={profile.role} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          profile={{ full_name: profile.full_name, email: profile.email, role: profile.role }}
          churchName={churchName}
          abbreviation={abbreviation}
        />
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8 lg:px-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
