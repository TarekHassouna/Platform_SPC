export { isSupabaseConfigured, getSupabaseBrowserClient } from "./supabase/client";
import { getSupabaseBrowserClient } from "./supabase/client";

export const supabase = getSupabaseBrowserClient();
