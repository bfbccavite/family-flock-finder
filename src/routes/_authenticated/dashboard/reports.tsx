import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Heart, Megaphone, UsersRound } from "lucide-react";
import { can } from "@/lib/roles";
import { useFirstTimeVisitors, useStaffProfile } from "@/lib/church-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/dashboard/reports")({
  head: () => ({
    meta: [
      { title: "First-time Visitor Reports | BFBC Church Management System" },
      { name: "description", content: "Sunday visitor totals, prayer requests and referral insights." },
      { property: "og:title", content: "First-time Visitor Reports | BFBC" },
      { property: "og:description", content: "First-time visitor reporting for Bethel Fundamental Baptist Church." },
    ],
  }),
  component: VisitorReportsPage,
});

const FOLLOW_UP_STATUS: Record<string, { label: string; className: string }> = {
  met: { label: "Met", className: "bg-primary/10 text-primary" },
  followed_up: { label: "Followed up", className: "bg-secondary/15 text-secondary" },
  pending: { label: "Pending", className: "bg-muted text-muted-foreground" },
};

const PENDING_STATUS = { label: "Pending", className: "bg-muted text-muted-foreground" };

function FollowUpBadge({ status }: { status: string }) {
  const config = FOLLOW_UP_STATUS[status] ?? PENDING_STATUS;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.className}`}
    >
      {config.label}
    </span>
  );
}

function VisitorReportsPage() {
  const { data: profile } = useStaffProfile();
  const { data: visitors = [] } = useFirstTimeVisitors();
  const [dateFilter, setDateFilter] = useState("");
  const monthPrefix = new Date().toISOString().slice(0, 7);
  const filtered = dateFilter ? visitors.filter((visitor) => visitor.visit_date === dateFilter) : visitors;
  const thisMonth = visitors.filter((visitor) => visitor.visit_date.startsWith(monthPrefix)).length;
  const prayerRequests = visitors.filter((visitor) => visitor.wants_prayer).length;

  const sources = useMemo(() => {
    const counts = new Map<string, number>();
    visitors.forEach((visitor) => {
      const source = visitor.discovery_source?.trim() || "Not specified";
      counts.set(source, (counts.get(source) ?? 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [visitors]);
  const maxSource = Math.max(1, ...sources.map(([, count]) => count));

  if (!can(profile?.role, "view_visitors")) {
    return <Card className="mx-auto max-w-md"><CardContent className="py-10 text-center text-sm text-muted-foreground">Your staff role does not have access to visitor reports.</CardContent></Card>;
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div><h1 className="font-display text-3xl font-bold">First-time Visitor Reports</h1><p className="mt-1 text-sm text-muted-foreground">Sunday visitor reach and requested spiritual follow-ups.</p></div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="flex items-center gap-4 p-5"><span className="grid h-11 w-11 place-items-center rounded-lg bg-primary/10 text-primary"><UsersRound className="h-5 w-5" /></span><div><p className="text-xs font-semibold uppercase text-muted-foreground">Visitors this month</p><p className="font-display text-3xl font-bold">{thisMonth}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 p-5"><span className="grid h-11 w-11 place-items-center rounded-lg bg-accent text-accent-foreground"><Heart className="h-5 w-5" /></span><div><p className="text-xs font-semibold uppercase text-muted-foreground">Prayer requests</p><p className="font-display text-3xl font-bold">{prayerRequests}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 p-5"><span className="grid h-11 w-11 place-items-center rounded-lg bg-secondary/15 text-secondary"><Megaphone className="h-5 w-5" /></span><div><p className="text-xs font-semibold uppercase text-muted-foreground">Discovery sources</p><p className="font-display text-3xl font-bold">{sources.length}</p></div></CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.38fr)]">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-3"><div><CardTitle>All first-time visitors</CardTitle><p className="mt-1 text-sm text-muted-foreground">Filter the list by date of visit.</p></div><div className="flex items-center gap-2"><Input aria-label="Filter visitor report by date of visit" type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className="w-[180px]" />{dateFilter && <Button variant="outline" size="sm" onClick={() => setDateFilter("")}>Clear</Button>}</div></CardHeader>
          <CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Date</TableHead><TableHead>Found us through</TableHead><TableHead>Prayer</TableHead><TableHead>Next steps</TableHead><TableHead>Assigned staff</TableHead><TableHead>Remarks</TableHead></TableRow></TableHeader><TableBody>{filtered.map((visitor) => <TableRow key={visitor.id}><TableCell className="font-medium">{visitor.complete_name}</TableCell><TableCell><span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-primary" />{new Date(`${visitor.visit_date}T00:00:00`).toLocaleDateString()}</span></TableCell><TableCell>{visitor.discovery_source || "Not specified"}</TableCell><TableCell>{visitor.wants_prayer ? "Yes" : "No"}</TableCell><TableCell><FollowUpBadge status={visitor.follow_up_status} /></TableCell><TableCell>{visitor.assigned_staff || "—"}</TableCell><TableCell className="max-w-[240px] whitespace-pre-wrap break-words text-sm text-muted-foreground">{visitor.remarks || "—"}</TableCell></TableRow>)}</TableBody></Table></div>{filtered.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No visitors found for this date.</p>}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>How visitors found BFBC</CardTitle></CardHeader>
          <CardContent className="grid gap-4">{sources.length === 0 ? <p className="text-sm text-muted-foreground">No source data yet.</p> : sources.map(([source, count]) => <div key={source} className="grid gap-1.5"><div className="flex justify-between gap-3 text-sm"><span className="truncate">{source}</span><strong>{count}</strong></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-secondary" style={{ width: `${(count / maxSource) * 100}%` }} /></div></div>)}</CardContent>
        </Card>
      </div>
    </div>
  );
}
