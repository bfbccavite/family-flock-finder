import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { can } from "@/lib/roles";
import {
  MEMBERSHIP_STATUSES,
  labelOf,
  memberName,
  useFamilies,
  useMembers,
  useStaffProfile,
  type Member,
} from "@/lib/church-data";
import { MemberDialog } from "@/components/records/member-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export const Route = createFileRoute("/_authenticated/dashboard/members")({
  head: () => ({
    meta: [
      { title: "Members | BFBC Church Management System" },
      { name: "description", content: "Church membership records and family groupings." },
    ],
  }),
  component: MembersPage,
});

function MembersPage() {
  const { data: profile } = useStaffProfile();
  const role = profile?.role ?? null;
  const queryClient = useQueryClient();

  const membersQuery = useMembers();
  const familiesQuery = useFamilies();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [deleting, setDeleting] = useState<Member | null>(null);

  const canManage = can(role, "manage_members");
  const familyName = (id: string | null) =>
    familiesQuery.data?.find((f) => f.id === id)?.family_name ?? "—";

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["visitations"] });
      toast.success("Member deleted.");
      setDeleting(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (membersQuery.data ?? []).filter((m) => {
      const matchesStatus = statusFilter === "all" || m.membership_status === statusFilter;
      if (!matchesStatus) return false;
      if (!term) return true;
      return [memberName(m), m.phone, m.email, m.ministry, m.address]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [membersQuery.data, search, statusFilter]);

  if (!can(role, "view_members")) {
    return <NoAccess />;
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight">Members</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {membersQuery.data?.length ?? 0} records on file.
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add member
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[16rem] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, contact, ministry..."
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {MEMBERSHIP_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {membersQuery.isLoading ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Loading members...</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center">
              <Users className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {membersQuery.data?.length
                  ? "No members match your search."
                  : "No members have been added yet."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Family</TableHead>
                    <TableHead>Ministry</TableHead>
                    <TableHead>Status</TableHead>
                    {canManage && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <p className="font-medium">{memberName(m)}</p>
                        {m.family_role && (
                          <p className="text-xs text-muted-foreground">{m.family_role}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <p>{m.phone ?? "—"}</p>
                        {m.email && <p className="text-xs">{m.email}</p>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {familyName(m.family_id)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {m.ministry ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={m.membership_status === "active" ? "default" : "secondary"}
                          className="font-normal"
                        >
                          {labelOf(MEMBERSHIP_STATUSES, m.membership_status)}
                        </Badge>
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Edit ${memberName(m)}`}
                            onClick={() => {
                              setEditing(m);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${memberName(m)}`}
                            onClick={() => setDeleting(m)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {dialogOpen && (
        <MemberDialog
          key={editing?.id ?? "new"}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          member={editing}
          families={familiesQuery.data ?? []}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this member?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? memberName(deleting) : ""} and all of their visitation records will be
              permanently removed. This cannot be undone.
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

function NoAccess() {
  return (
    <Card className="mx-auto max-w-md">
      <CardContent className="py-10 text-center text-sm text-muted-foreground">
        Your role does not have access to membership records.
      </CardContent>
    </Card>
  );
}
