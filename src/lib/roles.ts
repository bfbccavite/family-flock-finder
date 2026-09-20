export const ROLES = [
  "super_admin",
  "secretary",
  "assistant_secretary",
  "ushering",
  "visitation",
  "pastor_elder",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  secretary: "Secretary",
  assistant_secretary: "Assistant Secretary",
  ushering: "Ushering",
  visitation: "Visitation",
  pastor_elder: "Pastor / Elder",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  super_admin: "Full system access, user management, and settings.",
  secretary: "Manages membership records, attendance, and reports.",
  assistant_secretary: "Assists with records and attendance entry.",
  ushering: "Records attendance and service headcounts.",
  visitation: "Manages visitation and follow-up of members.",
  pastor_elder: "Views reports and oversees congregation care.",
};

export type Capability =
  | "manage_users"
  | "manage_settings"
  | "view_audit_log"
  | "manage_members"
  | "view_members"
  | "manage_attendance"
  | "view_attendance"
  | "manage_visitation"
  | "view_visitation"
  | "view_reports";

export const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
  super_admin: [
    "manage_users",
    "manage_settings",
    "view_audit_log",
    "manage_members",
    "view_members",
    "manage_attendance",
    "view_attendance",
    "manage_visitation",
    "view_visitation",
    "view_reports",
  ],
  secretary: [
    "manage_members",
    "view_members",
    "manage_attendance",
    "view_attendance",
    "view_visitation",
    "view_reports",
  ],
  assistant_secretary: [
    "manage_members",
    "view_members",
    "manage_attendance",
    "view_attendance",
    "view_reports",
  ],
  ushering: ["manage_attendance", "view_attendance"],
  visitation: ["view_members", "manage_visitation", "view_visitation"],
  pastor_elder: ["view_members", "view_attendance", "view_visitation", "view_reports"],
};

export function can(role: Role | null | undefined, capability: Capability): boolean {
  if (!role) return false;
  return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}

export function roleLabel(role: string | null | undefined): string {
  if (!role) return "No role assigned";
  return ROLE_LABELS[role as Role] ?? role;
}

export function initials(name: string | null | undefined, fallback = "?"): string {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
