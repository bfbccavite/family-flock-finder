import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  VISIT_STATUSES,
  VISIT_TYPES,
  memberName,
  type Member,
  type Visitation,
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

export function VisitationDialog({
  open,
  onOpenChange,
  visit,
  members,
  defaultMemberId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visit: Visitation | null;
  members: Member[];
  defaultMemberId?: string;
}) {
  const queryClient = useQueryClient();
  const [memberId, setMemberId] = useState(visit?.member_id ?? defaultMemberId ?? "");
  const [visitType, setVisitType] = useState(visit?.visit_type ?? "home");
  const [status, setStatus] = useState(visit?.status ?? "completed");

  const save = useMutation({
    mutationFn: async (form: FormData) => {
      if (!memberId) throw new Error("Choose which member was visited.");
      const text = (key: string) => {
        const value = String(form.get(key) ?? "").trim();
        return value === "" ? null : value;
      };

      const payload = {
        member_id: memberId,
        visit_date: String(form.get("visit_date") ?? "") || new Date().toISOString().slice(0, 10),
        visit_type: visitType,
        status,
        visited_by: text("visited_by"),
        outcome: text("outcome"),
        notes: text("notes"),
        prayer_requests: text("prayer_requests"),
        follow_up_date: text("follow_up_date"),
      };

      if (visit) {
        const { error } = await supabase.from("visitations").update(payload).eq("id", visit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("visitations").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visitations"] });
      toast.success(visit ? "Visit updated." : "Visit recorded.");
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{visit ? "Edit visit" : "Record a visit"}</DialogTitle>
          <DialogDescription>
            Log the visit details, outcome and any follow-up that is needed.
          </DialogDescription>
        </DialogHeader>

        <form
          id="visit-form"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(new FormData(e.currentTarget));
          }}
          className="grid gap-4 sm:grid-cols-2"
        >
          <div className="grid gap-2 sm:col-span-2">
            <Label>Member visited</Label>
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a member" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {memberName(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="visit_date">Visit date</Label>
            <Input
              id="visit_date"
              name="visit_date"
              type="date"
              required
              defaultValue={visit?.visit_date ?? new Date().toISOString().slice(0, 10)}
            />
          </div>

          <div className="grid gap-2">
            <Label>Visit type</Label>
            <Select value={visitType} onValueChange={setVisitType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VISIT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VISIT_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="visited_by">Visited by</Label>
            <Input
              id="visited_by"
              name="visited_by"
              placeholder="Names of those who visited"
              defaultValue={visit?.visited_by ?? ""}
            />
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="outcome">Outcome</Label>
            <Input
              id="outcome"
              name="outcome"
              placeholder="e.g. Welcomed, plans to attend Sunday service"
              defaultValue={visit?.outcome ?? ""}
            />
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={3} defaultValue={visit?.notes ?? ""} />
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="prayer_requests">Prayer requests</Label>
            <Textarea
              id="prayer_requests"
              name="prayer_requests"
              rows={2}
              defaultValue={visit?.prayer_requests ?? ""}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="follow_up_date">Next follow-up</Label>
            <Input
              id="follow_up_date"
              name="follow_up_date"
              type="date"
              defaultValue={visit?.follow_up_date ?? ""}
            />
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="visit-form" disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {visit ? "Save changes" : "Save visit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
