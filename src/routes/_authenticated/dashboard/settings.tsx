import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { can } from "@/lib/roles";
import { useChurchSettings, useStaffProfile } from "@/lib/church-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/dashboard/settings")({
  head: () => ({
    meta: [
      { title: "Settings | BFBC Church Management System" },
      { name: "description", content: "Church name, address and service details." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: profile } = useStaffProfile();
  const { data: settings } = useChurchSettings();
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: async (form: FormData) => {
      const { error } = await supabase
        .from("church_settings")
        .update({
          church_name: String(form.get("church_name") ?? "").trim(),
          abbreviation: String(form.get("abbreviation") ?? "").trim(),
          address: String(form.get("address") ?? "").trim(),
          timezone: String(form.get("timezone") ?? "").trim() || "Asia/Manila",
          default_service: String(form.get("default_service") ?? "").trim() || null,
          updated_by: profile?.id ?? null,
        })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["church-settings"] });
      toast.success("Settings saved.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!can(profile?.role, "manage_settings")) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Only a Super Admin can change church settings.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          These details appear across the records system.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Church information</CardTitle>
          <CardDescription>Shown in the sidebar, header and printed reports.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            key={settings?.church_name}
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(new FormData(e.currentTarget));
            }}
            className="flex flex-col gap-4"
          >
            <div className="grid gap-2">
              <Label htmlFor="church_name">Church name</Label>
              <Input
                id="church_name"
                name="church_name"
                required
                defaultValue={settings?.church_name ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="abbreviation">Abbreviation</Label>
              <Input
                id="abbreviation"
                name="abbreviation"
                required
                maxLength={6}
                defaultValue={settings?.abbreviation ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address">Address</Label>
              <Textarea id="address" name="address" rows={2} defaultValue={settings?.address ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="default_service">Main service</Label>
              <Input
                id="default_service"
                name="default_service"
                placeholder="e.g. Sunday Morning Worship"
                defaultValue={settings?.default_service ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input id="timezone" name="timezone" defaultValue={settings?.timezone ?? "Asia/Manila"} />
            </div>
            <Button type="submit" className="self-start" disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save settings
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
