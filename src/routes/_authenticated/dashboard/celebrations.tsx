import { createFileRoute } from "@tanstack/react-router";
import { BellRing, Cake, Heart } from "lucide-react";
import { useFirstTimeVisitors, useMembers } from "@/lib/church-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/dashboard/celebrations")({
  head: () => ({ meta: [{ title: "Celebrations | BFBC Church Management System" }, { name: "description", content: "Member and visitor birthdays and anniversaries." }, { property: "og:title", content: "Celebrations | BFBC" }, { property: "og:description", content: "Upcoming BFBC birthdays and anniversaries." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: CelebrationsPage,
});

type Celebration = { name: string; date: string; type: "Birthday" | "Anniversary" };
const monthDay = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const nextOccurrence = (date: string) => { const [year, month, day] = date.split("-").map(Number); const now = new Date(); let next = new Date(now.getFullYear(), (month ?? 1) - 1, day ?? 1); if (next < new Date(now.getFullYear(), now.getMonth(), now.getDate())) next = new Date(now.getFullYear() + 1, (month ?? 1) - 1, day ?? 1); return next.getTime(); };

function CelebrationsPage() {
  const { data: members = [] } = useMembers();
  const { data: visitors = [] } = useFirstTimeVisitors();
  const celebrations: Celebration[] = [
    ...members.flatMap((member) => [{ name: [member.first_name, member.middle_name, member.last_name].filter(Boolean).join(" "), date: member.birth_date, type: "Birthday" as const }, { name: [member.first_name, member.last_name].join(" "), date: member.anniversary_date, type: "Anniversary" as const }].filter((item): item is Celebration => Boolean(item.date))),
    ...visitors.flatMap((visitor) => [{ name: visitor.complete_name, date: visitor.birth_date, type: "Birthday" as const }, { name: visitor.complete_name, date: visitor.anniversary_date, type: "Anniversary" as const }].filter((item): item is Celebration => Boolean(item.date))),
  ].sort((a, b) => a.date.slice(5).localeCompare(b.date.slice(5)));
  const now = Date.now(); const week = 7 * 24 * 60 * 60 * 1000;
  const upcoming = celebrations.filter((item) => { const difference = nextOccurrence(item.date) - now; return difference >= 0 && difference <= week; });
  const groups = Array.from({ length: 12 }, (_, month) => celebrations.filter((item) => Number(item.date.slice(5, 7)) === month + 1));
  return <div className="mx-auto flex max-w-6xl flex-col gap-6"><div><h1 className="font-display text-3xl font-bold">Celebrations</h1><p className="mt-1 text-sm text-muted-foreground">Birthdays and anniversaries from members and visitors.</p></div>{upcoming.length > 0 && <div className="flex gap-3 rounded-md border border-primary/30 bg-primary/10 p-4"><BellRing className="h-5 w-5 shrink-0 text-primary" /><div><p className="font-semibold">Celebrations within one week</p><p className="text-sm">{upcoming.map((item) => `${item.name} — ${item.type}, ${monthDay(item.date)}`).join(" · ")}</p></div></div>}<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{groups.map((items, month) => <Card key={month}><CardHeader><CardTitle>{new Date(2024, month).toLocaleDateString(undefined, { month: "long" })}</CardTitle></CardHeader><CardContent className="grid gap-3">{items.length === 0 ? <p className="text-sm text-muted-foreground">No celebrations</p> : items.map((item, index) => <div key={`${item.name}-${item.type}-${index}`} className="flex items-center gap-3 border-b pb-3 last:border-0 last:pb-0">{item.type === "Birthday" ? <Cake className="h-4 w-4 text-primary" /> : <Heart className="h-4 w-4 text-secondary" />}<div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.type}</p></div><span className="text-sm font-semibold">{monthDay(item.date)}</span></div>)}</CardContent></Card>)}</div></div>;
}