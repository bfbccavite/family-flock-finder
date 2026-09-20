import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/inactive")({
  head: () => ({
    meta: [
      { title: "Account deactivated | BFBC Church Management System" },
      { name: "description", content: "This staff account has been deactivated." },
      { property: "og:title", content: "Account deactivated | BFBC Church Management System" },
      { property: "og:description", content: "This staff account has been deactivated." },
    ],
  }),
  component: InactivePage,
});

function InactivePage() {
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Account deactivated</CardTitle>
          <CardDescription>
            Your staff account is no longer active, so church records are not available. Please
            contact a Super Admin if this is unexpected.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={signOut} variant="outline">
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
