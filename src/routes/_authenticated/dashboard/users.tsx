import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ROLES, ROLE_LABELS, can, roleLabel, type Role } from "@/lib/roles";
import { useStaffProfile } from "@/lib/church-data";
import { createStaffAccount } from "@/lib/staff.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/dashboard/users")({
  head: () => ({
    meta: [
      { title: "Staff accounts | BFBC Church Management System" },
      { name: "description", content: "Manage staff accounts, roles and access." },
    ],
  }),
  component: UsersPage,
});

type StaffRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  active: boolean;
  last_login_at: string | null;
  role: Role | null;
};

function UsersPage() {
  const { data: me } = useStaffProfile();
  const queryClient = useQueryClient();
  const createAccount = useServerFn(createStaffAccount);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newRole, setNewRole] = useState<Role>("secretary");

  const staffQuery = useQuery({
    queryKey: ["staff-list"],
    queryFn: async (): Promise<StaffRow[]> => {
      const [profiles, roles] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email, phone, active, last_login_at")
          .order("full_name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (profiles.error) throw profiles.error;
      return (profiles.data ?? []).map((p) => ({
        ...p,
        role: (roles.data?.find((r) => r.user_id === p.id)?.role ?? null) as Role | null,
      }));
    },
    enabled: can(me?.role, "manage_users"),
  });

  const addAccount = useMutation({
    mutationFn: async (form: FormData) => {
      await createAccount({
        data: {
          full_name: String(form.get("full_name") ?? ""),
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? ""),
          phone: String(form.get("phone") ?? ""),
          role: newRole,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-list"] });
      toast.success("Staff account created.");
      setDialogOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const setActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("profiles").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-list"] });
      toast.success("Account updated.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const setRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: Role }) => {
      const del = await supabase.from("user_roles").delete().eq("user_id", id);
      if (del.error) throw del.error;
      const ins = await supabase.from("user_roles").insert({ user_id: id, role });
      if (ins.error) throw ins.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-list"] });
      queryClient.invalidateQueries({ queryKey: ["staff-profile"] });
      toast.success("Role updated.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!can(me?.role, "manage_users")) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Only a Super Admin can manage staff accounts.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight">Staff accounts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create accounts, assign roles, and deactivate access.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add staff account
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Last sign-in</TableHead>
                  <TableHead>Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staffQuery.data?.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <p className="font-medium">
                        {s.full_name || "Unnamed"}
                        {s.id === me?.id && (
                          <Badge variant="secondary" className="ml-2 font-normal">
                            You
                          </Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{s.email}</p>
                    </TableCell>
                    <TableCell>
                      {s.id === me?.id ? (
                        <span className="text-sm text-muted-foreground">{roleLabel(s.role)}</span>
                      ) : (
                        <Select
                          value={s.role ?? ""}
                          onValueChange={(role) => setRole.mutate({ id: s.id, role: role as Role })}
                        >
                          <SelectTrigger className="w-[190px]">
                            <SelectValue placeholder="No role" />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((r) => (
                              <SelectItem key={r} value={r}>
                                {ROLE_LABELS[r]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.last_login_at ? new Date(s.last_login_at).toLocaleString() : "Never"}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={s.active}
                        disabled={s.id === me?.id}
                        aria-label={`Account active for ${s.full_name}`}
                        onCheckedChange={(active) => setActive.mutate({ id: s.id, active })}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add staff account</DialogTitle>
            <DialogDescription>
              The account is ready to use immediately with the password you set here.
            </DialogDescription>
          </DialogHeader>
          <form
            id="staff-form"
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              addAccount.mutate(new FormData(e.currentTarget));
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="full_name">Full name</Label>
              <Input id="full_name" name="full_name" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Contact number</Label>
              <Input id="phone" name="phone" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Temporary password</Label>
              <Input id="password" name="password" type="password" required minLength={8} />
            </div>
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as Role)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="staff-form" disabled={addAccount.isPending}>
              {addAccount.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
