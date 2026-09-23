import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, MoreHorizontal, Pencil, Plus, Trash2, UserRoundCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { can } from "@/lib/roles";
import { useFirstTimeVisitors, useStaffProfile, type FirstTimeVisitor } from "@/lib/church-data";
import { VisitorDialog } from "@/components/records/visitor-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/dashboard/visitors")({
  head: () => ({
    meta: [
      { title: "Sunday Visitor Intake | BFBC Church Management System" },
      { name: "description", content: "Welcome and record first-time Sunday visitors." },
      { property: "og:title", content: "Sunday Visitor Intake | BFBC" },
      { property: "og:description", content: "First-time visitor intake for Bethel Fundamental Baptist Church." },
    ],
  }),
  component: VisitorsPage,
});

function VisitorsPage() {
  const { data: profile } = useStaffProfile();
  const { data: visitors = [], isLoading } = useFirstTimeVisitors();
  const queryClient = useQueryClient();
  const [dateFilter, setDateFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FirstTimeVisitor | null>(null);

  const filtered = useMemo(
    () => (dateFilter ? visitors.filter((visitor) => visitor.visit_date === dateFilter) : visitors),
    [visitors, dateFilter],
  );

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("first_time_visitors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["first-time-visitors"] });
      toast.success("Visitor record deleted.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!can(profile?.role, "view_visitors")) {
    return <Card className="mx-auto max-w-md"><CardContent className="py-10 text-center text-sm text-muted-foreground">Your staff role does not have access to Sunday visitor records.</CardContent></Card>;
  }

  const canManage = can(profile?.role, "manage_visitors");

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Sunday Visitor Intake</h1>
          <p className="mt-1 text-sm text-muted-foreground">Welcome and record first-time visitors in real time.</p>
        </div>
        {canManage && <Button onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" />New visitor</Button>}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <div className="grid gap-1.5">
          <label htmlFor="visitor-date-filter" className="text-xs font-semibold text-muted-foreground">Date of visit</label>
          <Input id="visitor-date-filter" type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className="w-[190px]" />
        </div>
        {dateFilter && <Button variant="outline" onClick={() => setDateFilter("")}>Clear date</Button>}
        <p className="ml-auto text-sm text-muted-foreground">{filtered.length} {filtered.length === 1 ? "visitor" : "visitors"}</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-14 text-center text-sm text-muted-foreground">Loading visitors...</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <UserRoundCheck className="h-9 w-9 text-primary" />
              <div><p className="font-display font-semibold">No first-time visitors found</p><p className="text-sm text-muted-foreground">New Sunday visitor records will appear here.</p></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Visitor</TableHead><TableHead>Date of visit</TableHead><TableHead>Contact</TableHead><TableHead>Spiritual next steps</TableHead>{canManage && <TableHead className="w-12" />}</TableRow></TableHeader>
                <TableBody>
                  {filtered.map((visitor) => (
                    <TableRow key={visitor.id}>
                      <TableCell><p className="font-medium">{visitor.complete_name}</p><p className="max-w-[260px] truncate text-xs text-muted-foreground">{visitor.address || visitor.religion || "No additional details"}</p></TableCell>
                      <TableCell><span className="inline-flex items-center gap-1.5 text-sm"><CalendarDays className="h-3.5 w-3.5 text-primary" />{new Date(`${visitor.visit_date}T00:00:00`).toLocaleDateString()}</span></TableCell>
                      <TableCell className="text-sm">{visitor.contact_number || "—"}</TableCell>
                      <TableCell><div className="flex max-w-xs flex-wrap gap-1">{visitor.wants_to_know_christ && <Badge>Know Christ</Badge>}{visitor.wants_bible_study && <Badge variant="secondary">Bible Study</Badge>}{visitor.wants_prayer && <Badge variant="outline">Prayer</Badge>}{!visitor.wants_to_know_christ && !visitor.wants_bible_study && !visitor.wants_prayer && <span className="text-sm text-muted-foreground">None selected</span>}</div></TableCell>
                      {canManage && <TableCell><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Actions for ${visitor.complete_name}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => { setEditing(visitor); setDialogOpen(true); }}><Pencil className="mr-2 h-4 w-4" />Edit</DropdownMenuItem><DropdownMenuItem className="text-destructive" onSelect={() => { if (window.confirm(`Delete ${visitor.complete_name}'s visitor record?`)) remove.mutate(visitor.id); }}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem></DropdownMenuContent></DropdownMenu></TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      <VisitorDialog key={editing?.id ?? "new"} open={dialogOpen} onOpenChange={setDialogOpen} visitor={editing} />
    </div>
  );
}