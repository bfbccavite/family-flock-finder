import { createClient } from '@supabase/supabase-js'
import { createAPIFileRoute } from '@tanstack/start/api'

export default createAPIFileRoute('/api/cron')({
  GET: async ({ request }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    )

    const { error } = await supabase.auth.getSession()

    if (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true, message: "Supabase database is wide awake!" }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  },
})
