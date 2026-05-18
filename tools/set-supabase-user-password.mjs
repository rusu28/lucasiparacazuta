import { createClient } from "@supabase/supabase-js";

const [email, password] = process.argv.slice(2);
const supabaseUrl =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email || !password) {
  console.error("Usage: node tools/set-supabase-user-password.mjs <email> <new-password>");
  process.exit(1);
}

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

let page = 1;
let targetUser = null;

while (!targetUser) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
  if (error) {
    throw error;
  }

  targetUser = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
  if (targetUser || data.users.length < 100) {
    break;
  }
  page += 1;
}

if (!targetUser) {
  console.error(`User not found: ${email}`);
  process.exit(1);
}

const { error } = await supabase.auth.admin.updateUserById(targetUser.id, {
  password,
});

if (error) {
  throw error;
}

console.log(`Password updated for ${email}.`);
