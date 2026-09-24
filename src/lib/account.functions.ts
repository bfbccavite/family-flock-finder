import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const SECURITY_QUESTIONS = [
  "What was the name of your first school?",
  "What is the name of the street where you grew up?",
  "What was the name of your first pet?",
  "What is your mother's middle name?",
  "What city were you born in?",
] as const;

const normalizeName = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
const normalizeAnswer = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
const hashAnswer = (answer: string, salt: string) =>
  createHash("sha256").update(`${salt}:${normalizeAnswer(answer)}`).digest("hex");
const signInAddress = () => `staff-${crypto.randomUUID()}@bfbc.local`;

const credentialsSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  password: z.string().min(8).max(128),
});

const recoveryDetailsSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  security_question: z.enum(SECURITY_QUESTIONS),
  secret_answer: z.string().trim().min(2).max(200),
});

export const resolveNameLogin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => credentialsSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: account } = await supabaseAdmin
      .from("account_recovery")
      .select("auth_email")
      .eq("normalized_full_name", normalizeName(data.full_name))
      .maybeSingle();
    return account?.auth_email ? { email: account.auth_email } : { email: null };
  });

export const getRecoveryQuestion = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ full_name: z.string().trim().min(2).max(120) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: account } = await supabaseAdmin
      .from("account_recovery")
      .select("security_question, locked_until")
      .eq("normalized_full_name", normalizeName(data.full_name))
      .maybeSingle();
    if (!account || account.security_question === "Recovery question not set") {
      throw new Error("No password recovery question is available for this name.");
    }
    if (account.locked_until && new Date(account.locked_until) > new Date()) {
      throw new Error("Too many attempts. Please try again later.");
    }
    return { question: account.security_question };
  });

export const resetPasswordWithSecurityAnswer = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => credentialsSchema.extend({ secret_answer: z.string().trim().min(2).max(200) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const normalized = normalizeName(data.full_name);
    const { data: account } = await supabaseAdmin
      .from("account_recovery")
      .select("user_id, answer_salt, answer_hash, failed_attempts, locked_until")
      .eq("normalized_full_name", normalized)
      .maybeSingle();
    if (!account) throw new Error("The name or secret answer is incorrect.");
    if (account.locked_until && new Date(account.locked_until) > new Date()) {
      throw new Error("Too many attempts. Please try again later.");
    }

    const actual = Buffer.from(hashAnswer(data.secret_answer, account.answer_salt), "hex");
    const expected = Buffer.from(account.answer_hash, "hex");
    const correct = actual.length === expected.length && timingSafeEqual(actual, expected);
    if (!correct) {
      const attempts = account.failed_attempts + 1;
      await supabaseAdmin.from("account_recovery").update({
        failed_attempts: attempts >= 5 ? 0 : attempts,
        locked_until: attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null,
        last_attempt_at: new Date().toISOString(),
      }).eq("user_id", account.user_id);
      throw new Error("The name or secret answer is incorrect.");
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(account.user_id, { password: data.password });
    if (error) throw new Error("The password could not be reset.");
    await supabaseAdmin.from("account_recovery").update({ failed_attempts: 0, locked_until: null, last_attempt_at: new Date().toISOString() }).eq("user_id", account.user_id);
    return { ok: true };
  });

export async function createNameBasedAccount({
  full_name,
  password,
  security_question,
  secret_answer,
  role,
  phone,
}: z.infer<typeof credentialsSchema> & z.infer<typeof recoveryDetailsSchema> & { role: string; phone?: string }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const normalized = normalizeName(full_name);
  const { data: existing } = await supabaseAdmin.from("account_recovery").select("user_id").eq("normalized_full_name", normalized).maybeSingle();
  if (existing) throw new Error("A staff account with this full name already exists.");

  const email = signInAddress();
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, profile_email: "", phone: phone || null, role, active: true },
  });
  if (error || !created.user) throw new Error(error?.message ?? "Could not create the staff account.");

  const salt = randomBytes(16).toString("hex");
  const { error: recoveryError } = await supabaseAdmin.from("account_recovery").insert({
    user_id: created.user.id,
    normalized_full_name: normalized,
    auth_email: email,
    security_question,
    answer_salt: salt,
    answer_hash: hashAnswer(secret_answer, salt),
  });
  if (recoveryError) {
    await supabaseAdmin.auth.admin.deleteUser(created.user.id);
    throw new Error("Could not create the staff recovery details.");
  }
}

export const saveMyRecoveryDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ security_question: z.enum(SECURITY_QUESTIONS), secret_answer: z.string().trim().min(2).max(200) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const salt = randomBytes(16).toString("hex");
    const { error } = await supabaseAdmin.from("account_recovery").update({
      security_question: data.security_question,
      answer_salt: salt,
      answer_hash: hashAnswer(data.secret_answer, salt),
      failed_attempts: 0,
      locked_until: null,
    }).eq("user_id", context.userId);
    if (error) throw new Error("Could not save recovery details.");
    return { ok: true };
  });

export { credentialsSchema, recoveryDetailsSchema };