import { supabase } from "@/integrations/supabase/client";

// Runs once per page load (fresh visit or reload): clears any saved sign-in
// so staff must sign in every time they open the site.
let cleared: Promise<void> | null = null;

export function clearSessionOnPageLoad(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (!cleared) {
    cleared = supabase.auth
      .signOut({ scope: "local" })
      .then(() => {})
      .catch(() => {});
  }
  return cleared;
}
