import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  checkSecurityAnswer,
  lookupSecurityQuestion,
  resetPasswordWithSecurityAnswer,
  setupNeeded,
} from "@/lib/staff.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { ChurchMark } from "@/components/app-shell/church-mark";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Staff sign in | BFBC Church Management System" },
      { name: "description", content: "Sign in to the BFBC church records system." },
      { property: "og:title", content: "Staff sign in | BFBC Church Management System" },
      { property: "og:description", content: "Sign in to the BFBC church records system." },
    ],
  }),
  component: AuthPage,
});

type View = "login" | "recover-name" | "recover-answer" | "recover-password";

function AuthPage() {
  const navigate = useNavigate();
  const lookupQuestion = useServerFn(lookupSecurityQuestion);
  const verifyAnswer = useServerFn(checkSecurityAnswer);
  const resetPassword = useServerFn(resetPasswordWithSecurityAnswer);
  const ensureAdmin = useServerFn(setupNeeded);

  useQuery({
    queryKey: ["setup-needed"],
    queryFn: () => ensureAdmin(),
  });

  const [view, setView] = useState<View>("login");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [recoverName, setRecoverName] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    // Resolve the staff member's sign-in email from their full name. Roles and
    // permissions are unchanged: this authenticates the same account, just by name.
    const { data: loginEmail, error: lookupError } = await supabase.rpc("get_login_email", {
      _full_name: fullName.trim(),
    });

    if (lookupError || !loginEmail) {
      setError("Incorrect name or password.");
      setLoading(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    });

    if (signInError) {
      const msg = signInError.message.toLowerCase();
      if (msg.includes("invalid login credentials")) setError("Incorrect name or password.");
      else if (msg.includes("email not confirmed"))
        setError("This account has not been confirmed yet.");
      else if (msg.includes("rate limit")) setError("Too many attempts. Please wait a moment.");
      else setError("Something went wrong signing you in. Please try again.");
      setLoading(false);
      return;
    }

    await supabase.rpc("touch_last_login").then(
      () => {},
      () => {},
    );
    navigate({ to: "/dashboard", replace: true });
  }

  function openRecovery() {
    setError(null);
    setRecoverName(fullName);
    setQuestion("");
    setAnswer("");
    setNewPassword("");
    setConfirmPassword("");
    setView("recover-name");
  }

  async function handleLookupName(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await lookupQuestion({ data: { full_name: recoverName.trim() } });
      setQuestion(result.question);
      setView("recover-answer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not find that account.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckAnswer(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await verifyAnswer({
        data: { full_name: recoverName.trim(), answer: answer.trim() },
      });
      setView("recover-password");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect secret answer.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSavePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await resetPassword({
        data: {
          full_name: recoverName.trim(),
          answer: answer.trim(),
          new_password: newPassword,
        },
      });
      setFullName(recoverName.trim());
      setPassword("");
      setView("login");
      setError(null);
      setNotice("Password updated. Sign in with your new password.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not update the password.";
      if (message.toLowerCase().includes("incorrect")) {
        setView("recover-answer");
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const titles: Record<View, { title: string; description: string }> = {
    login: {
      title: "Sign in",
      description: "Enter your staff credentials to continue.",
    },
    "recover-name": {
      title: "Forgot password",
      description: "Enter your full name to look up your security question.",
    },
    "recover-answer": {
      title: "Security question",
      description: "Answer the question you chose when this account was created.",
    },
    "recover-password": {
      title: "Set a new password",
      description: "Choose a new password for your staff account.",
    },
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <ChurchMark abbreviation="BFBC" className="h-12 w-12 text-sm" />
          <div>
            <h1 className="font-serif text-xl font-semibold tracking-tight">
              Bethel Fundamental Baptist Church
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Church Management System</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{titles[view].title}</CardTitle>
            <CardDescription>{titles[view].description}</CardDescription>
          </CardHeader>
          <CardContent>
            {view === "login" && (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="full_name">Full name</Label>
                  <Input
                    id="full_name"
                    type="text"
                    autoComplete="username"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Juan Dela Cruz"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="password">Password</Label>
                  <PasswordInput
                    id="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                {notice && (
                  <p role="status" className="text-sm text-primary">
                    {notice}
                  </p>
                )}
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
                <Button type="submit" disabled={loading} className="mt-2 w-full">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign in
                </Button>
                <button
                  type="button"
                  className="text-center text-sm text-primary underline-offset-4 hover:underline"
                  onClick={openRecovery}
                >
                  Forgot password?
                </button>
              </form>
            )}

            {view === "recover-name" && (
              <form onSubmit={handleLookupName} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="recover_name">Full name</Label>
                  <Input
                    id="recover_name"
                    type="text"
                    required
                    value={recoverName}
                    onChange={(e) => setRecoverName(e.target.value)}
                    placeholder="e.g. Michelle delos Reyes"
                  />
                </div>
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
                <Button type="submit" disabled={loading} className="w-full">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Continue
                </Button>
                <Button type="button" variant="ghost" onClick={() => { setError(null); setView("login"); }}>
                  Back to sign in
                </Button>
              </form>
            )}

            {view === "recover-answer" && (
              <form onSubmit={handleCheckAnswer} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label>Security question</Label>
                  <p className="rounded-md border bg-muted/50 px-3 py-2 text-sm">{question}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="secret_answer">Secret answer</Label>
                  <Input
                    id="secret_answer"
                    type="text"
                    required
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
                <Button type="submit" disabled={loading} className="w-full">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Continue
                </Button>
                <Button type="button" variant="ghost" onClick={() => { setError(null); setView("recover-name"); }}>
                  Use a different name
                </Button>
              </form>
            )}

            {view === "recover-password" && (
              <form onSubmit={handleSavePassword} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="new_password">New password</Label>
                  <PasswordInput
                    id="new_password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="confirm_password">Confirm new password</Label>
                  <PasswordInput
                    id="confirm_password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
                <Button type="submit" disabled={loading} className="w-full">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save new password
                </Button>
                <Button type="button" variant="ghost" onClick={() => { setError(null); setView("recover-answer"); }}>
                  Back
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
