import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { FirstTimeVisitor } from "@/lib/church-data";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function today() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function VisitorDialog({
  open,
  onOpenChange,
  visitor,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visitor?: FirstTimeVisitor | null;
}) {
  const queryClient = useQueryClient();
  const [wantsChrist, setWantsChrist] = useState(visitor?.wants_to_know_christ ?? false);
  const [wantsStudy, setWantsStudy] = useState(visitor?.wants_bible_study ?? false);
  const [wantsPrayer, setWantsPrayer] = useState(visitor?.wants_prayer ?? false);
  const [wantsCounseling, setWantsCounseling] = useState(visitor?.wants_counseling ?? false);
  const [facebook, setFacebook] = useState(visitor?.found_facebook ?? false);
  const [google, setGoogle] = useState(visitor?.found_google ?? false);
  const [referred, setReferred] = useState(Boolean(visitor?.referred_by));
  const [companion, setCompanion] = useState(Boolean(visitor?.companion_of));
  const [other, setOther] = useState(Boolean(visitor?.discovery_other));

  const save = useMutation({
    mutationFn: async (form: FormData) => {
      const { data: userData } = await supabase.auth.getUser();
      const values = {
        complete_name: String(form.get("complete_name") ?? "").trim(),
        visit_date: String(form.get("visit_date") ?? today()),
        birth_date: String(form.get("birth_date") ?? "") || null,
        address: String(form.get("address") ?? "").trim() || null,
        contact_number: String(form.get("contact_number") ?? "").trim() || null,
        religion: String(form.get("religion") ?? "").trim() || null,
        discovery_source: null,
        found_facebook: facebook,
        found_google: google,
        referred_by: referred ? String(form.get("referred_by") ?? "").trim() || null : null,
        companion_of: companion ? String(form.get("companion_of") ?? "").trim() || null : null,
        discovery_other: other ? String(form.get("discovery_other") ?? "").trim() || null : null,
        gender: String(form.get("gender") ?? "") || null,
        spiritual_maturity: String(form.get("spiritual_maturity") ?? "") || null,
        anniversary_date: String(form.get("anniversary_date") ?? "") || null,
        wants_to_know_christ: wantsChrist,
        wants_bible_study: wantsStudy,
        wants_prayer: wantsPrayer,
        wants_counseling: wantsCounseling,
        recorded_by: userData.user?.id ?? null,
      };

      const result = visitor
        ? await supabase.from("first_time_visitors").update(values).eq("id", visitor.id)
        : await supabase.from("first_time_visitors").insert(values);
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["first-time-visitors"] });
      toast.success(visitor ? "Visitor record updated." : "Visitor welcomed and recorded.");
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{visitor ? "Edit Sunday visitor" : "Sunday Visitor Intake"}</DialogTitle>
          <DialogDescription>
            Record a first-time visitor separately from member visitation records.
          </DialogDescription>
        </DialogHeader>
        <form
          id="visitor-intake-form"
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate(new FormData(event.currentTarget));
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="complete_name">Complete name</Label>
              <Input id="complete_name" name="complete_name" required defaultValue={visitor?.complete_name ?? ""} autoFocus />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="visit_date">Date of visit</Label>
              <Input id="visit_date" name="visit_date" type="date" required defaultValue={visitor?.visit_date ?? today()} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="birth_date">Date of birth</Label>
              <Input id="birth_date" name="birth_date" type="date" defaultValue={visitor?.birth_date ?? ""} />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Textarea id="address" name="address" rows={2} defaultValue={visitor?.address ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contact_number">Contact number</Label>
              <Input id="contact_number" name="contact_number" type="tel" defaultValue={visitor?.contact_number ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="religion">Religion</Label>
              <Input id="religion" name="religion" defaultValue={visitor?.religion ?? ""} />
            </div>
            <div className="grid gap-2"><Label htmlFor="gender">Gender</Label><select id="gender" name="gender" defaultValue={visitor?.gender ?? ""} className="h-9 rounded-md border border-input bg-background px-3 text-sm"><option value="">Not specified</option><option>Male</option><option>Female</option></select></div>
            <div className="grid gap-2"><Label htmlFor="spiritual_maturity">Spiritual maturity</Label><select id="spiritual_maturity" name="spiritual_maturity" defaultValue={visitor?.spiritual_maturity ?? ""} className="h-9 rounded-md border border-input bg-background px-3 text-sm"><option value="">Not specified</option>{["A","B","C","D"].map((stage) => <option key={stage}>{stage}</option>)}</select></div>
            <div className="grid gap-2"><Label htmlFor="anniversary_date">Anniversary date</Label><Input id="anniversary_date" name="anniversary_date" type="date" defaultValue={visitor?.anniversary_date ?? ""} /></div>
          </div>

          <fieldset className="grid gap-3 rounded-lg border p-4">
            <legend className="px-1 font-display text-sm font-semibold">How did they find out about our church?</legend>
            <label className="flex items-center gap-3 text-sm"><Checkbox checked={facebook} onCheckedChange={(value) => setFacebook(value === true)} />Facebook / Social Media</label>
            <label className="flex items-center gap-3 text-sm"><Checkbox checked={google} onCheckedChange={(value) => setGoogle(value === true)} />Google / Google Maps</label>
            <div className="grid gap-2 sm:grid-cols-[auto_1fr]"><label className="flex items-center gap-3 text-sm"><Checkbox checked={referred} onCheckedChange={(value) => setReferred(value === true)} />Referred by:</label><Input name="referred_by" disabled={!referred} defaultValue={visitor?.referred_by ?? ""} aria-label="Name of person who referred visitor" /></div>
            <div className="grid gap-2 sm:grid-cols-[auto_1fr]"><label className="flex items-center gap-3 text-sm"><Checkbox checked={companion} onCheckedChange={(value) => setCompanion(value === true)} />Companion of:</label><Input name="companion_of" disabled={!companion} defaultValue={visitor?.companion_of ?? ""} aria-label="Name of visitor companion" /></div>
            <div className="grid gap-2"><label className="flex items-center gap-3 text-sm"><Checkbox checked={other} onCheckedChange={(value) => setOther(value === true)} />Others:</label><Textarea name="discovery_other" disabled={!other} rows={3} defaultValue={visitor?.discovery_other ?? ""} aria-label="Other discovery details" /></div>
          </fieldset>

          <fieldset className="grid gap-3 rounded-lg border bg-muted/40 p-4">
            <legend className="px-1 font-display text-sm font-semibold">Spiritual next steps</legend>
            <label className="flex items-start gap-3 text-sm">
              <Checkbox checked={wantsChrist} onCheckedChange={(checked) => setWantsChrist(checked === true)} />
              <span>I want to know more about Christ</span>
            </label>
            <label className="flex items-start gap-3 text-sm"><Checkbox checked={wantsCounseling} onCheckedChange={(checked) => setWantsCounseling(checked === true)} /><span>I want to have counseling</span></label>
            <label className="flex items-start gap-3 text-sm">
              <Checkbox checked={wantsStudy} onCheckedChange={(checked) => setWantsStudy(checked === true)} />
              <span>I want to have a Bible Study</span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <Checkbox checked={wantsPrayer} onCheckedChange={(checked) => setWantsPrayer(checked === true)} />
              <span>I want someone to pray for me</span>
            </label>
          </fieldset>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="visitor-intake-form" disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {visitor ? "Save changes" : "Save visitor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}