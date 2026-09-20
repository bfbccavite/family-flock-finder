import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { HeartHandshake, Users, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { setupNeeded } from "@/lib/staff.functions";
import { Button } from "@/components/ui/button";
import { ChurchMark } from "@/components/app-shell/church-mark";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BFBC Church Management System" },
      {
        name: "description",
        content:
          "Staff sign-in for Bethel Fundamental Baptist Church membership and visitation records.",
      },
      { property: "og:title", content: "BFBC Church Management System" },
      {
        property: "og:description",
        content: "Membership and visitation records for Bethel Fundamental Baptist Church.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const checkSetup = useServerFn(setupNeeded);

  const { data: setup } = useQuery({
    queryKey: ["setup-needed"],
    queryFn: () => checkSetup(),
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-16 items-center gap-3 border-b px-5 md:px-8">
        <ChurchMark abbreviation="BFBC" />
        <div className="leading-tight">
          <p className="text-sm font-semibold">Bethel Fundamental Baptist Church</p>
          <p className="text-xs text-muted-foreground">Church Records</p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-10 px-5 py-16 md:px-8">
        <div className="flex flex-col gap-4">
          <h1 className="max-w-2xl font-serif text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
            Church Management System
          </h1>
          <p className="max-w-xl text-muted-foreground">
            Keep membership records and visitation follow-ups in one place. Access is limited to
            church staff accounts.
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            {setup?.needed ? (
              <Button asChild size="lg">
                <Link to="/setup">
                  Create the first administrator
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button asChild size="lg">
                <Link to="/auth">
                  Staff sign in
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border bg-card p-5">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="mt-3 font-medium">Membership records</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Contact details, family groupings, baptism dates and ministry involvement.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-5">
            <HeartHandshake className="h-5 w-5 text-primary" />
            <h2 className="mt-3 font-medium">Visitation tracking</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Log visits, record outcomes and prayer requests, and schedule follow-ups.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
