import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookOpen, Check, GraduationCap, Plus, Search, Settings2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { can } from "@/lib/roles";
import {
  CIVIL_STATUSES,
  isEligible,
  monthsSince,
  splitFullName,
  useBibleStudyParticipants,
  useBibleStudySettings,
  useFirstTimeVisitors,
  useStaffProfile,
  type BibleStudyParticipant,
} from "@/lib/church-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/dashboard/bible-study")({
  head: () => ({
    meta: [
      { title: "Bible Study | BFBC Church Management System" },
      { name: "description", content: "Track Bible Study attendance and promote eligible participants to the baptismal class." },
      { property: "og:title", content: "Bible Study | BFBC" },
      { property: "og:description", content: "Bible Study attendance and baptismal class eligibility." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BibleStudyPage,
});

const fullName = (p: Pick<BibleStudyParticipant, "first_name" | "middle_name" | "last_name">) =>
  [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" ");

function BibleStudyPage() {
  const { data: profile } = useStaffProfile();
  const role = profile?.role ?? null;
  const qc = useQueryClient();
  const { data: participants = [], isLoading } = useBibleStudyParticipants();
  const { data: settings = { required_sessions: 12, min_tenure_months: 3 } } = useBibleStudySettings();
  const [tab, setTab] = useState("active");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const canManage = can(role, "manage_visitors");
  const canPromote = can(role, "manage_members");
  const canRules = can(role, "manage_bible_study_rules");

  const toggleSession = useMutation({
    mutationFn: async ({ p, n }: { p: BibleStudyParticipant; n: number }) => {
      const set = new Set(p.sessions_attended);
      if (set.has(n)) set.delete(n); else set.add(n);
      const { error } = await supabase
        .from("bible_study_participants")
        .update({ sessions_attended: [...set].sort((a, b) => a - b) })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bible-study"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const promote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("promote_participant_to_candidate", { _participant_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bible-study"] });
      qc.invalidateQueries({ queryKey: ["baptismal-candidates"] });
      toast.success("Promoted to the Baptismal Class.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bible_study_participants").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bible-study"] }); toast.success("Participant removed."); },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = useMemo(() => {
    const t = search.trim().toLowerCase();
    return participants.filter((p) => {
      if (tab === "active" ? p.promoted_at : !p.promoted_at) return false;
      if (tab === "active" && false) return false;
      return !t || [fullName(p), p.phone].filter(Boolean).some((v) => String(v).toLowerCase().includes(t));
    });
  }, [participants, search, tab]);

  if (!can(role, "view_visitors") && !can(role, "view_members")) {
    return <Card className="mx-auto max-w-md"><CardContent className="py-10 text-center text-sm text-muted-foreground">Your role does not have access to Bible Study.</CardContent></Card>;
  }

  const eligibleCount = participants.filter((p) => !p.promoted_at && isEligible(p, settings)).length;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bible Study</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Eligible for the Baptismal Class after {settings.required_sessions} sessions and at least {settings.min_tenure_months} month{settings.min_tenure_months === 1 ? "" : "s"}. {eligibleCount} eligible now.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setRulesOpen(true)}><Settings2 className="mr-2 h-4 w-4" />Eligibility rules</Button>
          {canManage && <Button onClick={() => setAdding(true)}><Plus className="mr-2 h-4 w-4" />Add participant</Button>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="active">In Bible Study</TabsTrigger>
            <TabsTrigger value="promoted">Promoted</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative min-w-[16rem] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or contact..." className="pl-9" />
        </div>
      </div>

      {isLoading ? (
        <p className="p-8 text-center text-sm text-muted-foreground">Loading...</p>
      ) : list.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-2 p-10 text-center"><BookOpen className="h-6 w-6 text-muted-foreground" /><p className="text-sm text-muted-foreground">No participants here yet.</p></CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((p) => {
            const eligible = isEligible(p, settings);
            const months = monthsSince(p.start_date);
            return (
              <Card key={p.id}>
                <CardContent className="flex flex-col gap-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{fullName(p)}</p>
                      <p className="text-xs text-muted-foreground">{[p.phone, p.address].filter(Boolean).join(" · ") || "No contact details"}</p>
                      <p className="text-xs text-muted-foreground">Started {p.start_date} · {months} month{months === 1 ? "" : "s"}{p.visitor_id ? " · From Sunday visitors" : ""}</p>
                    </div>
                    {p.promoted_at ? <Badge variant="secondary">Promoted</Badge> : eligible ? (
                      <Badge className="gap-1"><Check className="h-3 w-3" />Eligible for Baptismal Class</Badge>
                    ) : <Badge variant="secondary">{p.sessions_attended.length}/{settings.required_sessions} sessions</Badge>}
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Attendance checklist</p>
                    <div className="grid grid-cols-6 gap-2">
                      {Array.from({ length: settings.required_sessions }, (_, i) => i + 1).map((n) => {
                        const on = p.sessions_attended.includes(n);
                        return (
                          <button
                            key={n}
                            type="button"
                            disabled={!canManage || !!p.promoted_at || toggleSession.isPending}
                            onClick={() => toggleSession.mutate({ p, n })}
                            aria-pressed={on}
                            aria-label={`Session ${n}`}
                            className={`h-9 rounded-md border text-xs font-semibold transition-colors disabled:cursor-not-allowed ${on ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:border-primary/50"}`}
                          >
                            {on ? <Check className="mx-auto h-4 w-4" /> : n}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {!p.promoted_at && (canPromote || canManage) && (
                    <div className="flex items-center gap-2 border-t pt-4">
                      {canPromote && (
                        <Button className="flex-1" disabled={!eligible || promote.isPending} onClick={() => promote.mutate(p.id)}>
                          <GraduationCap className="mr-2 h-4 w-4" />Promote to Baptismal Class
                        </Button>
                      )}
                      {canManage && (
                        <Button variant="ghost" size="icon" aria-label={`Remove ${fullName(p)}`} onClick={() => confirm(`Remove ${fullName(p)} from Bible Study?`) && remove.mutate(p.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {adding && <AddParticipantDialog onClose={() => setAdding(false)} existingVisitorIds={new Set(participants.map((p) => p.visitor_id).filter(Boolean) as string[])} />}
      {rulesOpen && <RulesDialog editable={canRules} settings={settings} onClose={() => setRulesOpen(false)} />}
    </div>
  );
}

function AddParticipantDialog({ onClose, existingVisitorIds }: { onClose: () => void; existingVisitorIds: Set<string> }) {
  const qc = useQueryClient();
  const { data: visitors = [] } = useFirstTimeVisitors();
  const [visitorId, setVisitorId] = useState("");
  const [form, setForm] = useState({ first_name: "", middle_name: "", last_name: "", gender: "", birth_date: "", civil_status: "", phone: "", email: "", address: "", religion: "", anniversary_date: "", notes: "", start_date: new Date().toISOString().slice(0, 10) });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const pick = (id: string) => {
    setVisitorId(id);
    const v = visitors.find((x) => x.id === id);
    if (!v) return;
    const n = splitFullName(v.complete_name);
    setForm((f) => ({ ...f, ...n, gender: v.gender ?? "", birth_date: v.birth_date ?? "", phone: v.contact_number ?? "", address: v.address ?? "", religion: v.religion ?? "", anniversary_date: v.anniversary_date ?? "" }));
  };

  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const n = (v: string) => v.trim() || null;
      const { error } = await supabase.from("bible_study_participants").insert({
        visitor_id: visitorId || null,
        first_name: form.first_name.trim(), last_name: form.last_name.trim(), middle_name: n(form.middle_name),
        gender: n(form.gender), birth_date: n(form.birth_date), civil_status: n(form.civil_status), phone: n(form.phone),
        email: n(form.email), address: n(form.address), religion: n(form.religion), anniversary_date: n(form.anniversary_date),
        notes: n(form.notes), start_date: form.start_date, created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bible-study"] }); toast.success("Participant added to Bible Study."); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const sel = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Add Bible Study participant</DialogTitle></DialogHeader>
        <form id="bs-form" className="grid gap-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="grid gap-2">
            <Label htmlFor="visitor">Start from a Sunday visitor (optional)</Label>
            <select id="visitor" className={sel} value={visitorId} onChange={(e) => pick(e.target.value)}>
              <option value="">— Enter details manually —</option>
              {visitors.filter((v) => !existingVisitorIds.has(v.id)).map((v) => <option key={v.id} value={v.id}>{v.complete_name} ({v.visit_date})</option>)}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2"><Label htmlFor="fn">First name</Label><Input id="fn" required value={form.first_name} onChange={set("first_name")} /></div>
            <div className="grid gap-2"><Label htmlFor="mn">Middle name</Label><Input id="mn" value={form.middle_name} onChange={set("middle_name")} /></div>
            <div className="grid gap-2"><Label htmlFor="ln">Last name</Label><Input id="ln" required value={form.last_name} onChange={set("last_name")} /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2"><Label htmlFor="g">Gender</Label><select id="g" className={sel} value={form.gender} onChange={set("gender")}><option value="">—</option><option>Male</option><option>Female</option></select></div>
            <div className="grid gap-2"><Label htmlFor="cs">Civil status</Label><select id="cs" className={sel} value={form.civil_status} onChange={set("civil_status")}><option value="">—</option>{CIVIL_STATUSES.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div className="grid gap-2"><Label htmlFor="bd">Date of birth</Label><Input id="bd" type="date" value={form.birth_date} onChange={set("birth_date")} /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2"><Label htmlFor="ph">Contact number</Label><Input id="ph" type="tel" value={form.phone} onChange={set("phone")} /></div>
            <div className="grid gap-2"><Label htmlFor="em">Email</Label><Input id="em" type="email" value={form.email} onChange={set("email")} /></div>
            <div className="grid gap-2"><Label htmlFor="rel">Religion</Label><Input id="rel" value={form.religion} onChange={set("religion")} /></div>
          </div>
          <div className="grid gap-2"><Label htmlFor="ad">Address</Label><Input id="ad" value={form.address} onChange={set("address")} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2"><Label htmlFor="an">Anniversary date</Label><Input id="an" type="date" value={form.anniversary_date} onChange={set("anniversary_date")} /></div>
            <div className="grid gap-2"><Label htmlFor="sd">Bible Study start date</Label><Input id="sd" type="date" required value={form.start_date} onChange={set("start_date")} /></div>
          </div>
          <div className="grid gap-2"><Label htmlFor="nt">Notes</Label><Textarea id="nt" rows={2} value={form.notes} onChange={set("notes")} /></div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="bs-form" disabled={save.isPending}>Add participant</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RulesDialog({ editable, settings, onClose }: { editable: boolean; settings: { required_sessions: number; min_tenure_months: number }; onClose: () => void }) {
  const qc = useQueryClient();
  const [sessions, setSessions] = useState(String(settings.required_sessions));
  const [months, setMonths] = useState(String(settings.min_tenure_months));
  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("bible_study_settings").update({ required_sessions: Number(sessions), min_tenure_months: Number(months), updated_by: user?.id ?? null }).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bible-study-settings"] }); toast.success("Eligibility rules saved."); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Eligibility rules</DialogTitle></DialogHeader>
        <Card className="border-0 shadow-none">
          <CardHeader className="p-0 pb-3"><CardTitle className="text-sm">Eligible for Baptismal Class when both are met</CardTitle>
            <CardDescription>{editable ? "Pastors/Elders, Secretaries, Assistant Secretaries and the Super Admin can change these." : "Only Pastors/Elders, Secretaries, Assistant Secretaries and the Super Admin can change these."}</CardDescription></CardHeader>
          <CardContent className="grid gap-4 p-0">
            <div className="grid gap-2"><Label htmlFor="rs">Required sessions</Label><Input id="rs" type="number" min={1} max={52} disabled={!editable} value={sessions} onChange={(e) => setSessions(e.target.value)} /></div>
            <div className="grid gap-2"><Label htmlFor="rm">Minimum months in Bible Study</Label><Input id="rm" type="number" min={0} max={36} disabled={!editable} value={months} onChange={(e) => setMonths(e.target.value)} /></div>
          </CardContent>
        </Card>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          {editable && <Button disabled={save.isPending} onClick={() => save.mutate()}>Save rules</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
