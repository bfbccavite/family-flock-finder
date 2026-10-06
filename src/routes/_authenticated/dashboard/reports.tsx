import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarDays, Heart, Megaphone, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { can } from "@/lib/roles";
import {
  MEMBERSHIP_STATUSES,
  useFirstTimeVisitors,
  useMembers,
  useStaffProfile,
  useVisitorFollowUpActivities,
  type FirstTimeVisitor,
} from "@/lib/church-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/dashboard/reports")({
  head: () => ({
    meta: [
      { title: "Reports & Follow-up | BFBC Church Management System" },
      { name: "description", content: "Visitor follow-up, yearly activity log and congregation demographics." },
      { property: "og:title", content: "Reports & Follow-up | BFBC" },
      { property: "og:description", content: "Reporting for Bethel Fundamental Baptist Church." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VisitorReportsPage,
});

const CONTACTS = [
  { group: "Pastors", names: ["Pastor Maymon", "Pastor John"] },
  { group: "Elders", names: ["Elder Alex", "Elder Oliver", "Elder Mark"] },
];

function discoveryLabels(v: FirstTimeVisitor) {
  const out: string[] = [];
  if (v.found_facebook) out.push("Facebook / Social Media");
  if (v.found_google) out.push("Google / Google Maps");
  if (v.referred_by) out.push("Referred");
  if (v.companion_of) out.push("Companion");
  if (v.discovery_other) out.push("Others");
  if (out.length === 0 && v.discovery_source) out.push(v.discovery_source);
  return out.length ? out : ["Not specified"];
}

function ageOf(birth: string | null) {
  if (!birth) return null;
  const b = new Date(`${birth}T00:00:00`);
  const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
}

function BarGroup({ title, rows }: { title: string; rows: [string, number][] }) {
  const max = Math.max(1, ...rows.map(([, c]) => c));
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="grid gap-3">
        {rows.map(([label, count]) => (
          <div key={label} className="grid gap-1.5">
            <div className="flex justify-between text-sm"><span>{label}</span><strong>{count}</strong></div>
            <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(count / max) * 100}%` }} /></div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function FollowUpRow({ visitor, editable }: { visitor: FirstTimeVisitor; editable: boolean }) {
  const qc = useQueryClient();
  const known = CONTACTS.flatMap((c) => c.names);
  const [met, setMet] = useState<boolean | null>(visitor.spiritual_needs_met);
  const [contact, setContact] = useState(visitor.contacted_by ?? "");
  const [otherName, setOtherName] = useState(visitor.contacted_by_other ?? "");
  const [result, setResult] = useState(visitor.follow_up_result ?? "");
  const dirty =
    met !== visitor.spiritual_needs_met ||
    contact !== (visitor.contacted_by ?? "") ||
    otherName !== (visitor.contacted_by_other ?? "") ||
    result !== (visitor.follow_up_result ?? "");

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("first_time_visitors")
        .update({
          spiritual_needs_met: met,
          contacted_by: contact || null,
          contacted_by_other: contact === "Others" ? otherName.trim().slice(0, 120) || null : null,
          follow_up_result: result.trim().slice(0, 2000) || null,
        })
        .eq("id", visitor.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["first-time-visitors"] });
      qc.invalidateQueries({ queryKey: ["visitor-follow-up-activities"] });
      toast.success("Follow-up saved.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <TableRow className="align-top">
      <TableCell className="font-medium">
        <div className="flex flex-col gap-1">
          {visitor.complete_name}
          {visitor.urgent_outreach && met !== true && <Badge variant="destructive" className="w-fit gap-1"><AlertTriangle className="h-3 w-3" />Urgent</Badge>}
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap"><span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-primary" />{new Date(`${visitor.visit_date}T00:00:00`).toLocaleDateString()}</span></TableCell>
      <TableCell className="text-sm">{discoveryLabels(visitor).join(", ")}</TableCell>
      <TableCell>
        <div className="flex gap-1">
          {([true, false] as const).map((v) => (
            <Button key={String(v)} type="button" size="sm" disabled={!editable} variant={met === v ? (v ? "default" : "destructive") : "outline"} onClick={() => setMet(met === v ? null : v)}>{v ? "Yes" : "No"}</Button>
          ))}
        </div>
      </TableCell>
      <TableCell className="min-w-[180px]">
        <select aria-label="Contacted by" disabled={!editable} value={contact} onChange={(e) => setContact(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
          <option value="">Not yet</option>
          {CONTACTS.map((c) => <optgroup key={c.group} label={c.group}>{c.names.map((n) => <option key={n}>{n}</option>)}</optgroup>)}
          {contact && !known.includes(contact) && contact !== "Others" && <option>{contact}</option>}
          <option value="Others">Others</option>
        </select>
        {contact === "Others" && <Input className="mt-2" disabled={!editable} placeholder="Name" aria-label="Other contact name" value={otherName} onChange={(e) => setOtherName(e.target.value)} />}
      </TableCell>
      <TableCell className="min-w-[220px]">
        <Textarea rows={3} disabled={!editable} aria-label="Follow-up result" value={result} onChange={(e) => setResult(e.target.value)} />
        {editable && dirty && <Button size="sm" className="mt-2" disabled={save.isPending} onClick={() => save.mutate()}>Save</Button>}
      </TableCell>
    </TableRow>
  );
}

function VisitorReportsPage() {
  const { data: profile } = useStaffProfile();
  const { data: visitors = [] } = useFirstTimeVisitors();
  const { data: members = [] } = useMembers();
  const { data: activities = [] } = useVisitorFollowUpActivities();
  const [dateFilter, setDateFilter] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const monthPrefix = new Date().toISOString().slice(0, 7);
  const filtered = dateFilter ? visitors.filter((v) => v.visit_date === dateFilter) : visitors;
  const thisMonth = visitors.filter((v) => v.visit_date.startsWith(monthPrefix)).length;
  const prayerRequests = visitors.filter((v) => v.wants_prayer).length;
  const editable = can(profile?.role, "manage_visitors");
  const nameById = useMemo(() => new Map(visitors.map((v) => [v.id, v.complete_name])), [visitors]);

  const sources = useMemo(() => {
    const counts = new Map<string, number>();
    visitors.forEach((v) => discoveryLabels(v).forEach((s) => counts.set(s, (counts.get(s) ?? 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [visitors]);

  const demographics = useMemo(() => {
    const people = [
      ...members.map((m) => ({ birth: m.birth_date, gender: m.gender })),
      ...visitors.map((v) => ({ birth: v.birth_date, gender: v.gender })),
    ];
    const age: Record<string, number> = { "Kids (0-11)": 0, "Youth (12-20)": 0, "Adult (21-59)": 0, "Senior (60+)": 0, Unknown: 0 };
    const gender: Record<string, number> = { Male: 0, Female: 0, "Not specified": 0 };
    people.forEach((p) => {
      const a = ageOf(p.birth);
      (age as any)[a === null ? "Unknown" : a <= 11 ? "Kids (0-11)" : a <= 20 ? "Youth (12-20)" : a <= 59 ? "Adult (21-59)" : "Senior (60+)"]++;
      const g = (p.gender ?? "").toLowerCase();
      (gender as any)[g === "male" ? "Male" : g === "female" ? "Female" : "Not specified"]++;
    });
    const status = MEMBERSHIP_STATUSES.map((s) => [s.label, members.filter((m) => m.membership_status === s.value).length] as [string, number]);
    return { age: Object.entries(age), gender: Object.entries(gender), status };
  }, [members, visitors]);

  const yearActivities = activities.filter((a) => new Date(a.activity_date).getFullYear() === year);
  const monthly = Array.from({ length: 12 }, (_, i) => [
    new Date(2000, i, 1).toLocaleString(undefined, { month: "short" }),
    yearActivities.filter((a) => new Date(a.activity_date).getMonth() === i).length,
  ] as [string, number]);

  if (!can(profile?.role, "view_visitors")) {
    return <Card className="mx-auto max-w-md"><CardContent className="py-10 text-center text-sm text-muted-foreground">Your staff role does not have access to reports.</CardContent></Card>;
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div><h1 className="font-display text-3xl font-bold">Reports & Follow-up</h1><p className="mt-1 text-sm text-muted-foreground">Visitor follow-up, yearly activity, and congregation demographics.</p></div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="flex items-center gap-4 p-5"><span className="grid h-11 w-11 place-items-center rounded-lg bg-primary/10 text-primary"><UsersRound className="h-5 w-5" /></span><div><p className="text-xs font-semibold uppercase text-muted-foreground">Visitors this month</p><p className="font-display text-3xl font-bold">{thisMonth}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 p-5"><span className="grid h-11 w-11 place-items-center rounded-lg bg-accent text-accent-foreground"><Heart className="h-5 w-5" /></span><div><p className="text-xs font-semibold uppercase text-muted-foreground">Prayer requests</p><p className="font-display text-3xl font-bold">{prayerRequests}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 p-5"><span className="grid h-11 w-11 place-items-center rounded-lg bg-secondary/15 text-secondary"><Megaphone className="h-5 w-5" /></span><div><p className="text-xs font-semibold uppercase text-muted-foreground">Discovery sources</p><p className="font-display text-3xl font-bold">{sources.length}</p></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-3"><div><CardTitle>First-time visitors follow-up</CardTitle><p className="mt-1 text-sm text-muted-foreground">Filter by date of visit and record follow-up.</p></div><div className="flex items-center gap-2"><Input aria-label="Filter by date of visit" type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-[180px]" />{dateFilter && <Button variant="outline" size="sm" onClick={() => setDateFilter("")}>Clear</Button>}</div></CardHeader>
        <CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Date</TableHead><TableHead>Found us through</TableHead><TableHead>Spiritual Needs Met?</TableHead><TableHead>Contacted By</TableHead><TableHead>Result</TableHead></TableRow></TableHeader><TableBody>{filtered.map((v) => <FollowUpRow key={`${v.id}-${v.updated_at}`} visitor={v} editable={editable} />)}</TableBody></Table></div>{filtered.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No visitors found.</p>}</CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.4fr)]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3"><CardTitle>Visitations Update Activities — {year}</CardTitle><div className="flex gap-1"><Button size="sm" variant="outline" onClick={() => setYear(year - 1)}>‹</Button><Button size="sm" variant="outline" onClick={() => setYear(year + 1)}>›</Button></div></CardHeader>
          <CardContent className="grid gap-5">
            <div className="flex h-28 items-end gap-1.5">{monthly.map(([m, c]) => { const max = Math.max(1, ...monthly.map(([, x]) => x)); return <div key={m} className="flex flex-1 flex-col items-center gap-1"><span className="text-[10px] font-semibold">{c || ""}</span><div className="w-full rounded-t bg-secondary" style={{ height: `${(c / max) * 80}px` }} /><span className="text-[10px] text-muted-foreground">{m}</span></div>; })}</div>
            <div className="max-h-80 overflow-y-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Visitor</TableHead><TableHead>Update</TableHead></TableRow></TableHeader><TableBody>{yearActivities.map((a) => <TableRow key={a.id}><TableCell className="whitespace-nowrap">{new Date(a.activity_date).toLocaleDateString()}</TableCell><TableCell>{nameById.get(a.visitor_id) ?? "—"}</TableCell><TableCell className="text-sm">{a.details || a.activity_type}</TableCell></TableRow>)}</TableBody></Table>{yearActivities.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No follow-up activity logged this year.</p>}</div>
          </CardContent>
        </Card>
        <BarGroup title="How visitors found BFBC" rows={sources.length ? sources : [["No data yet", 0]]} />
      </div>

      <div><h2 className="font-display text-xl font-semibold">Master database overview</h2><p className="text-sm text-muted-foreground">Members and visitors combined ({members.length + visitors.length} people); membership status counts members only.</p></div>
      <div className="grid gap-6 md:grid-cols-3">
        <BarGroup title="Age groups" rows={demographics.age} />
        <BarGroup title="Gender" rows={demographics.gender} />
        <BarGroup title="Membership status" rows={demographics.status} />
      </div>
    </div>
  );
}
