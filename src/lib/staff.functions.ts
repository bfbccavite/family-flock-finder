import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createNameBasedAccount, recoveryDetailsSchema } from "@/lib/account.functions";

const ROLE_VALUES = [
  "super_admin",
  "secretary",
  "assistant_secretary",
  "ushering",
  "visitation",
  "pastor_elder",
] as const;

/** True when no staff account exists yet, so the one-time setup can run. */
export const setupNeeded = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error } = await supabaseAdmin
    .from("profiles")
    .select("id", { count: "exact", head: true });
  if (error) return { needed: false };
  return { needed: (count ?? 0) === 0 };
});

const newAccountSchema = z.object({
  full_name: z.string().trim().min(2, "Full name is required."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  phone: z.string().trim().optional(),
  role: z.enum(ROLE_VALUES),
});

/** One-time creation of the very first Super Admin account. */
export const createFirstAdmin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => newAccountSchema.omit({ role: true, phone: true }).merge(recoveryDetailsSchema).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true });
    if ((count ?? 0) > 0) {
      throw new Error("Setup has already been completed.");
    }

    await createNameBasedAccount({ ...data, role: "super_admin" });
    return { ok: true };
  });

/** Super Admin creates a staff account with a role. */
export const createStaffAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => newAccountSchema.merge(recoveryDetailsSchema).parse(data))
  .handler(async ({ data, context }) => {
    const { data: allowed, error: checkError } = await context.supabase.rpc("has_capability", {
      _user_id: context.userId,
      _capability: "manage_users",
    });
    if (checkError) throw new Error(checkError.message);
    if (!allowed) throw new Error("You are not allowed to create staff accounts.");

    await createNameBasedAccount(data);
    return { ok: true };
  });
