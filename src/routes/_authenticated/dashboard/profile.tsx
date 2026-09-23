import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { roleLabel } from "@/lib/roles";
import { useStaffProfile } from "@/lib/church-data";
import { SECURITY_QUESTIONS } from "@/lib/security-questions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const [securityQuestion, setSecurityQuestion] = useState<string>(SECURITY_QUESTIONS[0]);

  useEffect(() => {
    if (
      profile?.security_question &&
      (SECURITY_QUESTIONS as readonly string[]).includes(profile.security_question)
    ) {
      setSecurityQuestion(profile.security_question);
    }
  }, [profile?.security_question]);

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

  const saveRecovery = useMutation({
    mutationFn: async (form: FormData) => {
      const answer = String(form.get("security_answer") ?? "").trim();
      if (answer.length < 2) throw new Error("Enter a security answer.");
      const { error } = await supabase.rpc("set_own_security_recovery", {
        _question: securityQuestion,
        _answer: answer,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-profile"] });
      toast.success("Security question updated.");
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
          <CardTitle className="text-base">Password recovery</CardTitle>
          <CardDescription>
            Used on the sign-in page if you forget your password. Your secret answer is stored
            securely and is never shown again.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveRecovery.mutate(new FormData(e.currentTarget));
              e.currentTarget.reset();
            }}
            className="flex flex-col gap-4"
          >
            <div className="grid gap-2">
              <Label>Security question</Label>
              <Select value={securityQuestion} onValueChange={setSecurityQuestion}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SECURITY_QUESTIONS.map((q) => (
                    <SelectItem key={q} value={q}>
                      {q}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="security_answer">Secret answer</Label>
              <Input
                id="security_answer"
                name="security_answer"
                required
                autoComplete="off"
                placeholder={profile.security_question ? "Enter a new answer to save" : undefined}
              />
            </div>
            <Button type="submit" className="self-start" disabled={saveRecovery.isPending}>
              {saveRecovery.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save security question
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
              <PasswordInput
                id="current_password"
                name="current_password"
                autoComplete="current-password"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new_password">New password</Label>
              <PasswordInput
                id="new_password"
                name="new_password"
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
