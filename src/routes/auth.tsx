import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

function AuthPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Enter your staff credentials to continue.</CardDescription>
          </CardHeader>
          <CardContent>
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
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={loading} className="mt-2 w-full">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign in
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
