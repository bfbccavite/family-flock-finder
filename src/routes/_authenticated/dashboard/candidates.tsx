import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, GraduationCap, Pencil, Plus, Search, Trash2, Droplets } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { can } from "@/lib/roles";
import { memberName, useFamilies, useStaffProfile, type Member } from "@/lib/church-data";
import { MemberDialog } from "@/components/records/member-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/dashboard/candidates")({
  head: () => ({
    meta: [
      { title: "Baptismal Class Candidates | BFBC Church Management System" },
      { name: "description", content: "Track baptismal class candidates and transfer them to membership." },
      { property: "og:title", content: "Baptismal Class Candidates | BFBC" },
      { property: "og:description", content: "Track baptismal class candidates and transfer them to membership." },
    ],
  }),
  component: CandidatesPage,
});

type Candidate = Member & {
  is_baptized: boolean;
  is_class_completed: boolean;
  class_completed_at: string | null;
  applied_for_membership: boolean;
  interviewed_for_membership: boolean;
  transferred_at: string | null;
};

type StepKey = "is_baptized" | "applied_for_membership" | "interviewed_for_membership";
const STEPS: { key: StepKey; label: string }[] = [
  { key: "is_baptized", label: "Baptized" },
  { key: "applied_for_membership", label: "Applied for Membership" },
  { key: "interviewed_for_membership", label: "Interviewed for Membership" },
];

function CandidatesPage() {
  const { data: profile } = useStaffProfile();
  const role = profile?.role ?? null;
  const qc = useQueryClient();
  const familiesQuery = useFamilies();
  const candidatesQuery = useQuery({
    queryKey: ["baptismal-candidates"],
    queryFn: async (): Promise<Candidate[]> => {
      const { data, error } = await supabase
        .from("baptismal_candidates")
        .select("*")
        .order("last_name")
        .order("first_name");
      if (error) throw error;
      return data as Candidate[];
    },
  });

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("active");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Candidate | null>(null);
  const [deleting, setDeleting] = useState<Candidate | null>(null);
  const [transferring, setTransferring] = useState<Candidate | null>(null);
  const canManage = can(role, "manage_members");

  const toggle = useMutation({
    mutationFn: async ({ id, key, value }: { id: string; key: StepKey; value: boolean }) => {
      const { error } = await supabase.from("baptismal_candidates").update({ [key]: value } as Record<StepKey, boolean>).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["baptismal-candidates"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const classToggle = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase
        .from("baptismal_candidates")
        .update({ is_class_completed: value, class_completed_at: value ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
      return value;
    },
    onSuccess: (value) => {
      qc.invalidateQueries({ queryKey: ["baptismal-candidates"] });
      toast.success(value ? "Candidate marked as class completed" : "Candidate marked as class pending");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("baptismal_candidates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["baptismal-candidates"] });
      toast.success("Candidate deleted.");
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const transfer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("transfer_candidate_to_member", { _candidate_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["baptismal-candidates"] });
      qc.invalidateQueries({ queryKey: ["members"] });
      toast.success("Transferred to Membership records.");
      setTransferring(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (candidatesQuery.data ?? []).filter((c) => {
      if (tab === "active" ? c.transferred_at : !c.transferred_at) return false;
      if (!term) return true;
      return [memberName(c), c.phone, c.email].filter(Boolean).some((v) => String(v).toLowerCase().includes(term));
    });
  }, [candidatesQuery.data, search, tab]);

  if (!can(role, "view_members")) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Your role does not have access to baptismal candidates.
        </CardContent>
      </Card>
    );
  }

  const activeCount = (candidatesQuery.data ?? []).filter((c) => !c.transferred_at).length;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Baptismal Class Candidates</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeCount} candidate{activeCount === 1 ? "" : "s"} in the class. Kept separate from Membership records.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Add candidate
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="active">In class</TabsTrigger>
            <TabsTrigger value="transferred">Transferred (archive)</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative min-w-[16rem] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or contact..." className="pl-9" />
        </div>
      </div>

      {candidatesQuery.isLoading ? (
        <p className="p-8 text-center text-sm text-muted-foreground">Loading candidates...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
            <Droplets className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {tab === "active" ? "No candidates in the baptismal class yet." : "No candidates transferred yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((c) => {
            const done = STEPS.filter((s) => c[s.key]).length;
            const ready = done === STEPS.length;
            return (
              <Card key={c.id}>
                <CardContent className="flex flex-col gap-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{memberName(c)}</p>
                      <p className="text-xs text-muted-foreground">
                        {[c.phone, c.email].filter(Boolean).join(" · ") || "No contact details"}
                      </p>
                      {c.baptism_date && (
                        <p className="text-xs text-muted-foreground">Baptism date: {c.baptism_date}</p>
                      )}
                    </div>
                    {c.transferred_at ? (
                      <Badge variant="secondary">Transferred</Badge>
                    ) : (
                      <Badge variant={ready ? "default" : "secondary"}>{done}/3 steps</Badge>
                    )}
                  </div>

                  <div>
                    {c.is_class_completed ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
                        <Check className="h-3.5 w-3.5" /> Baptismal Class Completed
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                        Class Pending
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm font-medium">
                      Mark Baptismal Class as Completed
                      <Switch
                        checked={c.is_class_completed}
                        disabled={!canManage || !!c.transferred_at || classToggle.isPending}
                        onCheckedChange={(v) => classToggle.mutate({ id: c.id, value: v })}
                      />
                    </label>
                    {STEPS.map((s) => (
                      <label key={s.key} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={c[s.key]}
                          disabled={!canManage || !!c.transferred_at || toggle.isPending}
                          onCheckedChange={(v) => toggle.mutate({ id: c.id, key: s.key, value: v === true })}
                        />
                        {s.label}
                      </label>
                    ))}
                  </div>

                  {canManage && !c.transferred_at && (
                    <div className="flex flex-wrap items-center gap-2 border-t pt-4">
                      <Button className="flex-1" onClick={() => setTransferring(c)}>
                        <GraduationCap className="mr-2 h-4 w-4" /> Graduate / Transfer to Membership
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={`Edit ${memberName(c)}`} onClick={() => { setEditing(c); setDialogOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={`Delete ${memberName(c)}`} onClick={() => setDeleting(c)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {dialogOpen && (
        <MemberDialog
          key={editing?.id ?? "new"}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          member={editing}
          families={familiesQuery.data ?? []}
          table="baptismal_candidates"
        />
      )}

      <AlertDialog open={!!transferring} onOpenChange={(o) => !o && setTransferring(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transfer to Membership?</AlertDialogTitle>
            <AlertDialogDescription>
              {transferring ? memberName(transferring) : ""}'s details will be copied into Membership records as an
              active member, and they will move to the Transferred archive here.
              {transferring && STEPS.some((s) => !transferring[s.key]) && " Note: not all steps are checked yet."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => transferring && transfer.mutate(transferring.id)}>Transfer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this candidate?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? memberName(deleting) : ""} will be permanently removed from the baptismal list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && remove.mutate(deleting.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
