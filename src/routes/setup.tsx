import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { createFirstAdmin, setupNeeded } from "@/lib/staff.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChurchMark } from "@/components/app-shell/church-mark";
import { SECURITY_QUESTIONS } from "@/lib/account.functions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/setup")({
  head: () => ({
    meta: [
      { title: "First-time setup | BFBC Church Management System" },
      {
        name: "description",
        content: "Create the first Super Admin account for the BFBC church records system.",
      },
      { property: "og:title", content: "First-time setup | BFBC Church Management System" },
      {
        property: "og:description",
        content: "Create the first Super Admin account for the BFBC church records system.",
      },
    ],
  }),
  component: SetupPage,
});

function SetupPage() {
  const navigate = useNavigate();
  const checkSetup = useServerFn(setupNeeded);
  const createAdmin = useServerFn(createFirstAdmin);
  const [submitting, setSubmitting] = useState(false);
  const [question, setQuestion] = useState<(typeof SECURITY_QUESTIONS)[number] | "">("");

  const { data: setup, isLoading } = useQuery({
    queryKey: ["setup-needed"],
    queryFn: () => checkSetup(),
  });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSubmitting(true);
    try {
      await createAdmin({
        data: {
          full_name: String(form.get("full_name") ?? ""),
          password: String(form.get("password") ?? ""),
          security_question: question,
          secret_answer: String(form.get("secret_answer") ?? ""),
        },
      });
      toast.success("Administrator created. You can now sign in.");
      navigate({ to: "/auth", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the account.");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!setup?.needed) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Setup has already been completed for this system.
            </p>
            <Button onClick={() => navigate({ to: "/auth" })}>Go to sign in</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <ChurchMark abbreviation="BFBC" className="h-12 w-12 text-sm" />
          <div>
            <h1 className="font-serif text-xl font-semibold tracking-tight">
              Create the first administrator
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              This one-time setup creates the Super Admin account for your church records system.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardContent className="flex flex-col gap-5 pt-6">
              <div className="grid gap-2">
                <Label htmlFor="full_name">Full name</Label>
                <Input id="full_name" name="full_name" required placeholder="Juan dela Cruz" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                />
              </div>
              <div className="grid gap-2">
                <Label>Security question</Label>
                <Select required value={question} onValueChange={(value) => setQuestion(value as (typeof SECURITY_QUESTIONS)[number])}>
                  <SelectTrigger><SelectValue placeholder="Choose a security question" /></SelectTrigger>
                  <SelectContent>{SECURITY_QUESTIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="secret_answer">Secret answer</Label>
                <Input id="secret_answer" name="secret_answer" required minLength={2} autoComplete="off" />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create administrator
              </Button>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
}
