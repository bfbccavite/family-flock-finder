import type { Capability } from "@/lib/roles";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  HeartHandshake,
  BarChart3,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  capability?: Capability;
  comingSoon?: boolean;
};

export type NavSection = {
  heading: string;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    heading: "Overview",
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    heading: "Records",
    items: [
      { label: "Members", href: "/dashboard/members", icon: Users, capability: "view_members" },
      {
        label: "Visitation",
        href: "/dashboard/visitation",
        icon: HeartHandshake,
        capability: "view_visitation",
      },
      {
        label: "Attendance",
        href: "/dashboard/attendance",
        icon: ClipboardList,
        capability: "view_attendance",
        comingSoon: true,
      },
      {
        label: "Reports",
        href: "/dashboard/reports",
        icon: BarChart3,
        capability: "view_reports",
        comingSoon: true,
      },
    ],
  },
  {
    heading: "Administration",
    items: [
      { label: "Staff Accounts", href: "/dashboard/users", icon: ShieldCheck, capability: "manage_users" },
      { label: "Settings", href: "/dashboard/settings", icon: Settings, capability: "manage_settings" },
    ],
  },
];
