const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
    console.log("Applying Migration...");

    // Since we can't run raw SQL directly through standard supabase-js without an RPC function,
    // we'll try to use the rpc 'exec_sql' if available, otherwise we will instruct the user 
    // to run it via the Supabase Dashboard.

    const { data, error } = await supabase.rpc('exec_sql', {
        sql_string: `
      ALTER TABLE public.leaves ADD COLUMN IF NOT EXISTS group_id UUID;
      CREATE INDEX IF NOT EXISTS idx_leaves_group_id ON public.leaves(group_id);
    `
    });

    if (error) {
        console.log("RPC execution failed (exec_sql might not be installed).");
        console.log("ERROR DETAILS:", error);
        console.log("\\n\\n----- ACTION REQUIRED -----");
        console.log("Please copy the following SQL and execute it manually in your Supabase SQL Editor:");
        console.log("\\nALTER TABLE public.leaves ADD COLUMN IF NOT EXISTS group_id UUID;");
        console.log("CREATE INDEX IF NOT EXISTS idx_leaves_group_id ON public.leaves(group_id);\\n");
    } else {
        console.log("Migration successful!", data);
    }
}

runMigration();
