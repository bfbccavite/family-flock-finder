import { createClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/cron")({
  server: {
    handlers: {
      GET: async () => {
        const supabase = createClient(
          import.meta.env["VITE_SUPABASE_URL"],
          import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"],
          { auth: { persistSession: false, autoRefreshToken: false } },
        );
        const { error } = await supabase.auth.getSession();

        if (error) {
          return Response.json({ success: false, error: error.message }, { status: 500 });
        }

        return Response.json({
          success: true,
          message: "The BFBC application is responding.",
        });
      },
    },
  },
});
