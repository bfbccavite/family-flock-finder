import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { LoaderCircle, Sparkles } from "lucide-react";
import { generateVisitorOutreachRecommendation } from "@/lib/visitor-outreach.functions";
import type { FirstTimeVisitor } from "@/lib/church-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export function VisitorOutreachRecommendations({
  visitor,
  followUp,
}: {
  visitor: FirstTimeVisitor;
  followUp: { spiritualNeedsMet: boolean | null; contactedBy: string; result: string };
}) {
  const generate = useServerFn(generateVisitorOutreachRecommendation);
  const [open, setOpen] = useState(false);
  const [additionalContext, setAdditionalContext] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleGenerate() {
    setPending(true);
    setError("");
    try {
      const result = await generate({
        data: { visitorId: visitor.id, additionalContext, followUp },
      });
      setRecommendation(result.recommendation);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not generate suggestions. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Sparkles aria-hidden="true" />
        Next steps
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
              Outreach suggestions
            </DialogTitle>
            <DialogDescription>
              {visitor.complete_name} · visited{" "}
              {new Date(`${visitor.visit_date}T00:00:00`).toLocaleDateString()}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="flex flex-wrap gap-2" aria-label="Visitor interests">
              {visitor.wants_to_know_christ && <Badge>Learn more about Christ</Badge>}
              {visitor.wants_bible_study && <Badge variant="secondary">Bible Study</Badge>}
              {visitor.wants_prayer && <Badge variant="outline">Prayer</Badge>}
              {visitor.wants_counseling && <Badge variant="outline">Counseling</Badge>}
              {!visitor.wants_to_know_christ &&
                !visitor.wants_bible_study &&
                !visitor.wants_prayer &&
                !visitor.wants_counseling && (
                  <span className="text-sm text-muted-foreground">
                    No spiritual next steps were selected.
                  </span>
                )}
            </div>

            <div className="grid gap-2">
              <label htmlFor={`outreach-context-${visitor.id}`} className="text-sm font-medium">
                Additional follow-up context{" "}
                <span className="text-muted-foreground">(optional)</span>
              </label>
              <Textarea
                id={`outreach-context-${visitor.id}`}
                value={additionalContext}
                onChange={(event) => setAdditionalContext(event.target.value.slice(0, 1200))}
                placeholder="Add recent conversation details or a follow-up note"
                rows={3}
                maxLength={1200}
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            {recommendation && (
              <section aria-live="polite" className="grid gap-2 border-t pt-4">
                <h3 className="font-display font-semibold">Suggested next steps</h3>
                <p className="whitespace-pre-wrap text-sm leading-6">{recommendation}</p>
              </section>
            )}
            <p className="text-xs text-muted-foreground">
              Suggestions are drafts for staff review. Please respect the visitor’s consent and
              privacy.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button type="button" onClick={handleGenerate} disabled={pending}>
              {pending ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles aria-hidden="true" />
              )}
              {pending ? "Generating…" : recommendation ? "Generate again" : "Generate suggestions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
