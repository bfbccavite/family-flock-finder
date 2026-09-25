import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  CIVIL_STATUSES,
  MEMBERSHIP_STATUSES,
  type Family,
  type Member,
} from "@/lib/church-data";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE = "__none__";

export function MemberDialog({
  open,
  onOpenChange,
  member,
  families,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: Member | null;
  families: Family[];
}) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState(member?.membership_status ?? "active");
  const [gender, setGender] = useState(member?.gender ?? NONE);
  const [civil, setCivil] = useState(member?.civil_status ?? NONE);
  const [familyId, setFamilyId] = useState(member?.family_id ?? NONE);
  const [newFamily, setNewFamily] = useState("");

  const save = useMutation({
    mutationFn: async (form: FormData) => {
      let resolvedFamily: string | null = familyId === NONE ? null : familyId;

      if (newFamily.trim()) {
        const { data, error } = await supabase
          .from("families")
          .insert({ family_name: newFamily.trim() })
          .select("id")
          .single();
        if (error) throw error;
        resolvedFamily = data.id;
      }

      const text = (key: string) => {
        const value = String(form.get(key) ?? "").trim();
        return value === "" ? null : value;
      };

      const payload = {
        first_name: String(form.get("first_name") ?? "").trim(),
        middle_name: text("middle_name"),
        last_name: String(form.get("last_name") ?? "").trim(),
        gender: gender === NONE ? null : gender,
        birth_date: text("birth_date"),
        civil_status: civil === NONE ? null : civil,
        phone: text("phone"),
        email: text("email"),
        address: text("address"),
        membership_status: status,
        date_joined: text("date_joined"),
        baptism_date: text("baptism_date"),
        ministry: text("ministry"),
        family_id: resolvedFamily,
        family_role: text("family_role"),
        notes: text("notes"),
        anniversary_date: text("anniversary_date"),
        spiritual_maturity: text("spiritual_maturity"),
      };

      if (member) {
        const { error } = await supabase.from("members").update(payload).eq("id", member.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("members").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["families"] });
      toast.success(member ? "Member updated." : "Member added.");
      setNewFamily("");
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{member ? "Edit member" : "Add member"}</DialogTitle>
          <DialogDescription>
            Personal details, church life information and family grouping.
          </DialogDescription>
        </DialogHeader>

        <form
          id="member-form"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(new FormData(e.currentTarget));
          }}
          className="flex flex-col gap-6"
        >
          <section className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" htmlFor="first_name">
              <Input id="first_name" name="first_name" required defaultValue={member?.first_name} />
            </Field>
            <Field label="Middle name" htmlFor="middle_name">
              <Input
                id="middle_name"
                name="middle_name"
                defaultValue={member?.middle_name ?? ""}
              />
            </Field>
            <Field label="Last name" htmlFor="last_name">
              <Input id="last_name" name="last_name" required defaultValue={member?.last_name} />
            </Field>
            <Field label="Gender">
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger>
                  <SelectValue placeholder="Not specified" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not specified</SelectItem>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Birthday" htmlFor="birth_date">
              <Input
                id="birth_date"
                name="birth_date"
                type="date"
                defaultValue={member?.birth_date ?? ""}
              />
            </Field>
            <Field label="Marital status">
              <Select value={civil} onValueChange={setCivil}>
                <SelectTrigger>
                  <SelectValue placeholder="Not specified" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not specified</SelectItem>
                  {CIVIL_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Contact number" htmlFor="phone">
              <Input id="phone" name="phone" defaultValue={member?.phone ?? ""} />
            </Field>
            <Field label="Email" htmlFor="email">
              <Input id="email" name="email" type="email" defaultValue={member?.email ?? ""} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Address" htmlFor="address">
                <Textarea id="address" name="address" rows={2} defaultValue={member?.address ?? ""} />
              </Field>
            </div>
          </section>

          <section className="grid gap-4 border-t pt-5 sm:grid-cols-2">
            <Field label="Membership status">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEMBERSHIP_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Ministry or group" htmlFor="ministry">
              <Input id="ministry" name="ministry" defaultValue={member?.ministry ?? ""} />
            </Field>
            <Field label="Date joined" htmlFor="date_joined">
              <Input
                id="date_joined"
                name="date_joined"
                type="date"
                defaultValue={member?.date_joined ?? ""}
              />
            </Field>
            <Field label="Baptism date" htmlFor="baptism_date">
              <Input
                id="baptism_date"
                name="baptism_date"
                type="date"
                defaultValue={member?.baptism_date ?? ""}
              />
            </Field>
            <Field label="Anniversary date" htmlFor="anniversary_date"><Input id="anniversary_date" name="anniversary_date" type="date" defaultValue={member?.anniversary_date ?? ""} /></Field>
            <Field label="Spiritual maturity stage"><select name="spiritual_maturity" defaultValue={member?.spiritual_maturity ?? ""} className="h-9 rounded-md border border-input bg-background px-3 text-sm"><option value="">Not specified</option>{["A","B","C","D"].map((stage) => <option key={stage}>{stage}</option>)}</select></Field>
          </section>

          <section className="grid gap-4 border-t pt-5 sm:grid-cols-2">
            <Field label="Family">
              <Select value={familyId} onValueChange={setFamilyId}>
                <SelectTrigger>
                  <SelectValue placeholder="No family" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No family</SelectItem>
                  {families.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.family_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Or create a new family" htmlFor="new_family">
              <Input
                id="new_family"
                value={newFamily}
                onChange={(e) => setNewFamily(e.target.value)}
                placeholder="e.g. Dela Cruz family"
              />
            </Field>
            <Field label="Role in the family" htmlFor="family_role">
              <Input
                id="family_role"
                name="family_role"
                placeholder="Head, spouse, child..."
                defaultValue={member?.family_role ?? ""}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Notes" htmlFor="notes">
                <Textarea id="notes" name="notes" rows={3} defaultValue={member?.notes ?? ""} />
              </Field>
            </div>
          </section>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} type="button">
            Cancel
          </Button>
          <Button type="submit" form="member-form" disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {member ? "Save changes" : "Add member"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
