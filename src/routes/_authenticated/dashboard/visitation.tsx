import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock, HeartHandshake, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { can } from "@/lib/roles";
import {
  VISIT_STATUSES,
  VISIT_TYPES,
  labelOf,
  memberName,
  useMembers,
  useStaffProfile,
  useVisitations,
  type Visitation,
} from "@/lib/church-data";
import { VisitationDialog } from "@/components/records/visitation-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

export const Route = createFileRoute("/_authenticated/dashboard/visitation")({
  head: () => ({
    meta: [
      { title: "Visitation | BFBC Church Management System" },
      { name: "description", content: "Visitation records and follow-up scheduling." },
    ],
  }),
  component: VisitationPage,
});

const today = () => new Date().toISOString().slice(0, 10);

function VisitationPage() {
  const { data: profile } = useStaffProfile();
  const role = profile?.role ?? null;
  const queryClient = useQueryClient();

  const visitsQuery = useVisitations();
  const membersQuery = useMembers();

  const [tab, setTab] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Visitation | null>(null);
  const [deleting, setDeleting] = useState<Visitation | null>(null);

  const canManage = can(role, "manage_visitation");
  const nameOf = (id: string) => {
    const m = membersQuery.data?.find((x) => x.id === id);
    return m ? memberName(m) : "Unknown member";
  };

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("visitations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visitations"] });
      toast.success("Visit deleted.");
      setDeleting(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const { overdue, upcoming, planned, all } = useMemo(() => {
    const list = visitsQuery.data ?? [];
    const now = today();
    return {
      all: list,
      overdue: list.filter((v) => v.follow_up_date && v.follow_up_date < now),
      upcoming: list.filter((v) => v.follow_up_date && v.follow_up_date >= now),
      planned: list.filter((v) => v.status === "planned"),
    };
  }, [visitsQuery.data]);

  const shown = tab === "overdue" ? overdue : tab === "upcoming" ? upcoming : tab === "planned" ? planned : all;

  if (!can(role, "view_visitation")) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Your role does not have access to visitation records.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight">Visitation</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {overdue.length} overdue follow-up{overdue.length === 1 ? "" : "s"} &middot;{" "}
            {upcoming.length} upcoming
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
            disabled={!membersQuery.data?.length}
          >
            <Plus className="mr-2 h-4 w-4" />
            Record a visit
          </Button>
        )}
      </div>

      {canManage && !membersQuery.data?.length && (
        <Card className="border-dashed">
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Add member records first — visits are always linked to a member.
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All visits</TabsTrigger>
          <TabsTrigger value="overdue">Overdue</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="planned">Planned</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          {visitsQuery.isLoading ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Loading visits...</p>
          ) : shown.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center">
              <HeartHandshake className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nothing to show here yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Visit</TableHead>
                    <TableHead>Visited by</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead>Follow-up</TableHead>
                    <TableHead>Status</TableHead>
                    {canManage && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((v) => {
                    const isOverdue = !!v.follow_up_date && v.follow_up_date < today();
                    return (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium">{nameOf(v.member_id)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <p>{v.visit_date}</p>
                          <p className="text-xs">{labelOf(VISIT_TYPES, v.visit_type)}</p>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {v.visited_by ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-[16rem] text-sm text-muted-foreground">
                          <p className="truncate">{v.outcome ?? "—"}</p>
                          {v.prayer_requests && (
                            <p className="truncate text-xs">Prayer: {v.prayer_requests}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {v.follow_up_date ? (
                            <span
                              className={
                                isOverdue
                                  ? "flex items-center gap-1 font-medium text-destructive"
                                  : "text-muted-foreground"
                              }
                            >
                              {isOverdue && <CalendarClock className="h-3.5 w-3.5" />}
                              {v.follow_up_date}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={v.status === "completed" ? "default" : "secondary"}
                            className="font-normal"
                          >
                            {labelOf(VISIT_STATUSES, v.status)}
                          </Badge>
                        </TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Edit visit"
                              onClick={() => {
                                setEditing(v);
                                setDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Delete visit"
                              onClick={() => setDeleting(v)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {dialogOpen && (
        <VisitationDialog
          key={editing?.id ?? "new"}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          visit={editing}
          members={membersQuery.data ?? []}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this visit record?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
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
