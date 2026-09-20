import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, Users, HeartHandshake } from "lucide-react";
import { can, roleLabel, ROLE_DESCRIPTIONS } from "@/lib/roles";
import { NAV_SECTIONS } from "@/lib/nav";
import { useMembers, useStaffProfile, useVisitations } from "@/lib/church-data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: DashboardHome,
});

function DashboardHome() {
  const { data: profile } = useStaffProfile();
  const role = profile?.role ?? null;

  const membersQuery = useMembers();
  const visitsQuery = useVisitations();

  const canViewMembers = can(role, "view_members");
  const canViewVisits = can(role, "view_visitation");

  const activeMembers =
    membersQuery.data?.filter((m) => m.membership_status === "active").length ?? 0;
  const today = new Date().toISOString().slice(0, 10);
  const dueFollowUps =
    visitsQuery.data?.filter((v) => v.follow_up_date && v.follow_up_date <= today).length ?? 0;
  const visitsThisMonth =
    visitsQuery.data?.filter(
      (v) => v.status === "completed" && v.visit_date.slice(0, 7) === today.slice(0, 7),
    ).length ?? 0;

  const quickLinks = NAV_SECTIONS.flatMap((s) => s.items).filter(
    (item) => item.href !== "/dashboard" && !item.comingSoon && (!item.capability || can(role, item.capability)),
  );

  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || "there";

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-2xl font-semibold tracking-tight">
            Welcome back, {firstName}
          </h1>
          <Badge variant="secondary" className="font-medium">
            {roleLabel(role)}
          </Badge>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {role ? ROLE_DESCRIPTIONS[role] : "No role has been assigned to your account yet."}
        </p>
      </div>

      {(canViewMembers || canViewVisits) && (
        <div className="grid gap-4 sm:grid-cols-3">
          {canViewMembers && (
            <StatCard
              icon={<Users className="h-5 w-5" />}
              label="Active members"
              value={activeMembers}
              hint={`${membersQuery.data?.length ?? 0} records in total`}
            />
          )}
          {canViewVisits && (
            <>
              <StatCard
                icon={<HeartHandshake className="h-5 w-5" />}
                label="Visits this month"
                value={visitsThisMonth}
              />
              <StatCard
                icon={<CalendarClock className="h-5 w-5" />}
                label="Follow-ups due"
                value={dueFollowUps}
                hint="Scheduled today or overdue"
              />
            </>
          )}
        </div>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-muted-foreground">Your modules</h2>
        {quickLinks.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              You don&apos;t have any modules assigned yet. Contact a Super Admin if this seems
              wrong.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {quickLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} to={item.href} className="group">
                  <Card className="h-full transition-colors hover:border-primary/40 hover:bg-accent/30">
                    <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <CardTitle className="text-base">{item.label}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription>Open the {item.label.toLowerCase()} module.</CardDescription>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-4 pt-6">
        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          {icon}
        </span>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="font-serif text-2xl font-semibold">{value}</p>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
