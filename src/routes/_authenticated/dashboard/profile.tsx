import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { roleLabel } from "@/lib/roles";
import { useStaffProfile } from "@/lib/church-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/dashboard/profile")({
  head: () => ({
    meta: [
      { title: "My profile | BFBC Church Management System" },
      { name: "description", content: "Update your staff profile details and password." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { data: profile } = useStaffProfile();
  const queryClient = useQueryClient();

  const saveProfile = useMutation({
    mutationFn: async (form: FormData) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: String(form.get("full_name") ?? "").trim(),
          phone: String(form.get("phone") ?? "").trim() || null,
        })
        .eq("id", profile!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-profile"] });
      toast.success("Profile updated.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const changePassword = useMutation({
    mutationFn: async (form: FormData) => {
      const current = String(form.get("current_password") ?? "");
      const next = String(form.get("new_password") ?? "");
      if (next.length < 8) throw new Error("New password must be at least 8 characters.");
      const { error } = await supabase.auth.updateUser({
        password: next,
        current_password: current,
      } as Parameters<typeof supabase.auth.updateUser>[0]);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => toast.success("Password changed."),
    onError: (error: Error) => toast.error(error.message),
  });

  if (!profile) return null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold tracking-tight">My profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Signed in as {profile.email} &middot; {roleLabel(profile.role)}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your details</CardTitle>
          <CardDescription>Your role can only be changed by a Super Admin.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveProfile.mutate(new FormData(e.currentTarget));
            }}
            className="flex flex-col gap-4"
          >
            <div className="grid gap-2">
              <Label htmlFor="full_name">Full name</Label>
              <Input id="full_name" name="full_name" required defaultValue={profile.full_name} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Contact number</Label>
              <Input id="phone" name="phone" defaultValue={profile.phone ?? ""} />
            </div>
            <Button type="submit" className="self-start" disabled={saveProfile.isPending}>
              {saveProfile.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Change password</CardTitle>
          <CardDescription>Use at least 8 characters.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              changePassword.mutate(new FormData(e.currentTarget));
              e.currentTarget.reset();
            }}
            className="flex flex-col gap-4"
          >
            <div className="grid gap-2">
              <Label htmlFor="current_password">Current password</Label>
              <Input
                id="current_password"
                name="current_password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new_password">New password</Label>
              <Input
                id="new_password"
                name="new_password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
              />
            </div>
            <Button type="submit" className="self-start" disabled={changePassword.isPending}>
              {changePassword.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Change password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
