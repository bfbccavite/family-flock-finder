import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getRecoveryQuestion, resetPasswordWithSecurityAnswer } from "@/lib/account.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Password recovery | BFBC" }, { name: "description", content: "Recover a BFBC staff account." }, { property: "og:title", content: "Password recovery | BFBC" }, { property: "og:description", content: "Recover a BFBC staff account." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const questionFn = useServerFn(getRecoveryQuestion);
  const resetFn = useServerFn(resetPasswordWithSecurityAnswer);
  const [fullName, setFullName] = useState("");
  const [question, setQuestion] = useState("");
  return <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4"><Card className="w-full max-w-md"><CardHeader><CardTitle>Forgot Password?</CardTitle></CardHeader><CardContent><form className="grid gap-4" onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); if (!question) { try { const result = await questionFn({ data: { full_name: fullName } }); setQuestion(result.question); } catch (error) { toast.error(error instanceof Error ? error.message : "Recovery question unavailable."); } return; } try { await resetFn({ data: { full_name: fullName, secret_answer: String(form.get("secret_answer") ?? ""), password: String(form.get("password") ?? "") } }); toast.success("Password reset. You can now sign in."); navigate({ to: "/auth" }); } catch (error) { toast.error(error instanceof Error ? error.message : "Password could not be reset."); } }}><div className="grid gap-2"><Label htmlFor="full_name">Full name</Label><Input id="full_name" required value={fullName} disabled={Boolean(question)} onChange={(event) => setFullName(event.target.value)} /></div>{question && <><p className="rounded-md bg-muted p-3 text-sm font-medium">{question}</p><div className="grid gap-2"><Label htmlFor="secret_answer">Secret answer</Label><Input id="secret_answer" name="secret_answer" required /></div><div className="grid gap-2"><Label htmlFor="password">New password</Label><Input id="password" name="password" type="password" minLength={8} required /></div></>}<Button type="submit">{question ? "Reset password" : "Continue"}</Button><Button asChild variant="ghost"><Link to="/auth">Back to sign in</Link></Button></form></CardContent></Card></div>;
}