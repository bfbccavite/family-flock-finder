import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Role } from "@/lib/roles";

export type StaffProfile = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  active: boolean;
  last_login_at: string | null;
  created_at: string;
  role: Role | null;
};

export type Member = {
  id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  gender: string | null;
  birth_date: string | null;
  civil_status: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  membership_status: string;
  date_joined: string | null;
  baptism_date: string | null;
  ministry: string | null;
  family_id: string | null;
  family_role: string | null;
  notes: string | null;
  created_at: string;
};

export type Family = {
  id: string;
  family_name: string;
  notes: string | null;
};

export type Visitation = {
  id: string;
  member_id: string;
  visit_date: string;
  visit_type: string;
  status: string;
  visited_by: string | null;
  outcome: string | null;
  notes: string | null;
  prayer_requests: string | null;
  follow_up_date: string | null;
  created_at: string;
};

export const MEMBERSHIP_STATUSES = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "transferred", label: "Transferred" },
  { value: "deceased", label: "Deceased" },
];

export const VISIT_TYPES = [
  { value: "home", label: "Home visit" },
  { value: "hospital", label: "Hospital" },
  { value: "phone", label: "Phone call" },
  { value: "follow_up", label: "Follow-up" },
];

export const VISIT_STATUSES = [
  { value: "planned", label: "Planned" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export const CIVIL_STATUSES = ["Single", "Married", "Widowed", "Separated"];

export function labelOf(list: { value: string; label: string }[], value: string | null) {
  if (!value) return "—";
  return list.find((i) => i.value === value)?.label ?? value;
}

export function memberName(m: Pick<Member, "first_name" | "middle_name" | "last_name">) {
  return [m.first_name, m.middle_name, m.last_name].filter(Boolean).join(" ");
}

export function useStaffProfile() {
  return useQuery({
    queryKey: ["staff-profile"],
    queryFn: async (): Promise<StaffProfile | null> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const [profileRes, rolesRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email, phone, active, last_login_at, created_at")
          .eq("id", user.id)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);

      if (!profileRes.data) return null;
      return {
        ...profileRes.data,
        role: (rolesRes.data?.[0]?.role ?? null) as Role | null,
      };
    },
    staleTime: 30_000,
  });
}

export function useChurchSettings() {
  return useQuery({
    queryKey: ["church-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("church_settings")
        .select("church_name, abbreviation, address, timezone, default_service")
        .eq("id", 1)
        .maybeSingle();
      return data;
    },
    staleTime: 60_000,
  });
}

export function useMembers() {
  return useQuery({
    queryKey: ["members"],
    queryFn: async (): Promise<Member[]> => {
      const { data, error } = await supabase
        .from("members")
        .select("*")
        .order("last_name")
        .order("first_name");
      if (error) throw error;
      return data as Member[];
    },
  });
}

export function useFamilies() {
  return useQuery({
    queryKey: ["families"],
    queryFn: async (): Promise<Family[]> => {
      const { data, error } = await supabase
        .from("families")
        .select("id, family_name, notes")
        .order("family_name");
      if (error) throw error;
      return data as Family[];
    },
  });
}

export function useVisitations() {
  return useQuery({
    queryKey: ["visitations"],
    queryFn: async (): Promise<Visitation[]> => {
      const { data, error } = await supabase
        .from("visitations")
        .select("*")
        .order("visit_date", { ascending: false });
      if (error) throw error;
      return data as Visitation[];
    },
  });
}
