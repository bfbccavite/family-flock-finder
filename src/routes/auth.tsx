import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChurchMark } from "@/components/app-shell/church-mark";
import { resolveNameLogin } from "@/lib/account.functions";

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
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const resolveLogin = useServerFn(resolveNameLogin);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const account = await resolveLogin({ data: { full_name: fullName } }).catch(() => ({ email: null }));
    const { error: signInError } = account.email
      ? await supabase.auth.signInWithPassword({ email: account.email, password })
      : { error: new Error("invalid login credentials") };

    if (signInError) {
      const msg = signInError.message.toLowerCase();
      if (msg.includes("invalid login credentials")) setError("Incorrect email or password.");
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
                   autoComplete="username"
                  required
                   value={fullName}
                   onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="pr-11" />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((value) => !value)}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <Link to="/forgot-password" className="self-end text-sm font-medium text-primary hover:underline">Forgot Password?</Link>
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
