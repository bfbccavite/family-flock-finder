import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DEFAULT_ADMIN,
  SECURITY_QUESTIONS,
  namesMatch,
} from "@/lib/security-questions";

const ROLE_VALUES = [
  "super_admin",
  "secretary",
  "assistant_secretary",
  "ushering",
  "visitation",
  "pastor_elder",
] as const;

const securityQuestionSchema = z.enum(SECURITY_QUESTIONS);

const newAccountSchema = z.object({
  full_name: z.string().trim().min(2, "Full name is required."),
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  phone: z.string().trim().optional(),
  role: z.enum(ROLE_VALUES),
  security_question: securityQuestionSchema,
  security_answer: z.string().trim().min(2, "Enter a security answer."),
});

async function findProfileByName(
  supabaseAdmin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"],
  fullName: string,
) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name, active")
    .eq("active", true);
  if (error) throw new Error(error.message);
  return (data ?? []).find((p) => namesMatch(p.full_name, fullName)) ?? null;
}

async function persistSecurityRecovery(
  supabaseAdmin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"],
  userId: string,
  question: string,
  answer: string,
) {
  const { data: hash, error: hashError } = await supabaseAdmin.rpc("hash_security_answer", {
    _answer: answer,
  });
  if (hashError || !hash) throw new Error(hashError?.message ?? "Could not save the security answer.");
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ security_question: question, security_answer_hash: hash })
    .eq("id", userId);
  if (error) throw new Error(error.message);
}

async function stripRecoveryMetadata(
  supabaseAdmin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"],
  userId: string,
  metadata: Record<string, unknown>,
) {
  const next = { ...metadata };
  delete next.security_answer;
  await supabaseAdmin.auth.admin.updateUserById(userId, { user_metadata: next });
}

async function ensureDefaultAdminAccount() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const existing = await findProfileByName(supabaseAdmin, DEFAULT_ADMIN.full_name);
  if (existing) {
    const { data: question } = await supabaseAdmin.rpc("get_security_question", {
      _full_name: DEFAULT_ADMIN.full_name,
    });
    if (!question) {
      await persistSecurityRecovery(
        supabaseAdmin,
        existing.id,
        DEFAULT_ADMIN.security_question,
        DEFAULT_ADMIN.security_answer,
      );
    }
    return;
  }

  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email: DEFAULT_ADMIN.email,
    password: DEFAULT_ADMIN.password,
    email_confirm: true,
    user_metadata: {
      full_name: DEFAULT_ADMIN.full_name,
      role: "super_admin",
      active: true,
      security_question: DEFAULT_ADMIN.security_question,
      security_answer: DEFAULT_ADMIN.security_answer,
    },
  });
  if (error) {
    // The seeded email may already exist even if the display name differs.
    const { data: users } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    const seeded = users?.users.find(
      (u) => u.email?.toLowerCase() === DEFAULT_ADMIN.email.toLowerCase(),
    );
    if (!seeded) throw new Error(error.message);
    await persistSecurityRecovery(
      supabaseAdmin,
      seeded.id,
      DEFAULT_ADMIN.security_question,
      DEFAULT_ADMIN.security_answer,
    );
    return;
  }
  if (created.user) {
    await persistSecurityRecovery(
      supabaseAdmin,
      created.user.id,
      DEFAULT_ADMIN.security_question,
      DEFAULT_ADMIN.security_answer,
    );
    await stripRecoveryMetadata(supabaseAdmin, created.user.id, created.user.user_metadata ?? {});
  }
}

/** True when no staff account exists yet, so the one-time setup can run. */
export const setupNeeded = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  try {
    await ensureDefaultAdminAccount();
  } catch {
    // Setup form remains available if automatic seeding cannot run yet.
  }
  const { count, error } = await supabaseAdmin
    .from("profiles")
    .select("id", { count: "exact", head: true });
  if (error) return { needed: false };
  return { needed: (count ?? 0) === 0 };
});

/** One-time creation of the very first Super Admin account. */
export const createFirstAdmin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => newAccountSchema.omit({ role: true, phone: true }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true });
    if ((count ?? 0) > 0) {
      throw new Error("Setup has already been completed.");
    }

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email.toLowerCase(),
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.full_name,
        role: "super_admin",
        active: true,
        security_question: data.security_question,
        security_answer: data.security_answer,
      },
    });
    if (error) throw new Error(error.message);
    if (created.user) {
      await persistSecurityRecovery(
        supabaseAdmin,
        created.user.id,
        data.security_question,
        data.security_answer,
      );
      await stripRecoveryMetadata(supabaseAdmin, created.user.id, created.user.user_metadata ?? {});
    }
    return { ok: true };
  });

/** Super Admin creates a staff account with a role. */
export const createStaffAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => newAccountSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: allowed, error: checkError } = await context.supabase.rpc("has_capability", {
      _user_id: context.userId,
      _capability: "manage_users",
    });
    if (checkError) throw new Error(checkError.message);
    if (!allowed) throw new Error("You are not allowed to create staff accounts.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email.toLowerCase(),
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.full_name,
        phone: data.phone ?? null,
        role: data.role,
        active: true,
        security_question: data.security_question,
        security_answer: data.security_answer,
      },
    });
    if (error) throw new Error(error.message);
    if (created.user) {
      await persistSecurityRecovery(
        supabaseAdmin,
        created.user.id,
        data.security_question,
        data.security_answer,
      );
      await stripRecoveryMetadata(supabaseAdmin, created.user.id, created.user.user_metadata ?? {});
    }
    return { ok: true };
  });

export const lookupSecurityQuestion = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ full_name: z.string().trim().min(2, "Full name is required.") }).parse(data),
  )
  .handler(async ({ data }) => {
    try {
      await ensureDefaultAdminAccount();
    } catch {
      // Continue lookup even if seeding is unavailable.
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const profile = await findProfileByName(supabaseAdmin, data.full_name);
    if (!profile) {
      // Default admin recovery stays available even before the profile row exists.
      if (namesMatch(data.full_name, DEFAULT_ADMIN.full_name)) {
        return { question: DEFAULT_ADMIN.security_question };
      }
      throw new Error("No matching staff account found.");
    }

    const { data: question } = await supabaseAdmin.rpc("get_security_question", {
      _full_name: data.full_name,
    });
    if (question) return { question };

    if (namesMatch(profile.full_name, DEFAULT_ADMIN.full_name)) {
      await persistSecurityRecovery(
        supabaseAdmin,
        profile.id,
        DEFAULT_ADMIN.security_question,
        DEFAULT_ADMIN.security_answer,
      );
      return { question: DEFAULT_ADMIN.security_question };
    }

    throw new Error("This account has no security question yet. Ask a Super Admin for help.");
  });

async function accountMatchesSecurityAnswer(fullName: string, answer: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  try {
    await ensureDefaultAdminAccount();
  } catch {
    // Fall through to verification against existing rows or the default admin.
  }

  const { data: matched, error: verifyError } = await supabaseAdmin.rpc("verify_security_answer", {
    _full_name: fullName,
    _answer: answer,
  });

  const isDefaultAdmin =
    namesMatch(fullName, DEFAULT_ADMIN.full_name) &&
    answer.trim().toLowerCase() === DEFAULT_ADMIN.security_answer.toLowerCase();

  if (verifyError && !isDefaultAdmin) {
    throw new Error("Could not verify the security answer. Please try again.");
  }
  if (!matched && !isDefaultAdmin) {
    throw new Error("Incorrect secret answer.");
  }

  let profile = await findProfileByName(supabaseAdmin, fullName);
  if (!profile && isDefaultAdmin) {
    await ensureDefaultAdminAccount();
    profile = await findProfileByName(supabaseAdmin, fullName);
  }
  if (!profile) throw new Error("No matching staff account found.");
  return { supabaseAdmin, profile };
}

export const checkSecurityAnswer = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        full_name: z.string().trim().min(2, "Full name is required."),
        answer: z.string().trim().min(1, "Enter your secret answer."),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await accountMatchesSecurityAnswer(data.full_name, data.answer);
    return { ok: true };
  });

export const resetPasswordWithSecurityAnswer = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        full_name: z.string().trim().min(2, "Full name is required."),
        answer: z.string().trim().min(1, "Enter your secret answer."),
        new_password: z.string().min(8, "New password must be at least 8 characters."),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin, profile } = await accountMatchesSecurityAnswer(
      data.full_name,
      data.answer,
    );
    const { error } = await supabaseAdmin.auth.admin.updateUserById(profile.id, {
      password: data.new_password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
