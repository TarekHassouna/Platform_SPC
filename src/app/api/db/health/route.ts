import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export async function GET() {
  if (!isSupabaseConfigured) {
    return NextResponse.json({
      connected: false,
      mode: "local",
      message: "Ajoutez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local pour activer Supabase.",
    });
  }

  try {
    const supabase = await getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ connected: false, mode: "local" });
    }
    const { error } = await supabase.from("concepts").select("id").limit(1);
    if (error) {
      return NextResponse.json(
        {
          connected: true,
          schemaReady: false,
          error: error.message,
          hint: "Exécutez supabase/schema.sql dans le SQL Editor de votre projet Supabase.",
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      connected: true,
      schemaReady: true,
      mode: "supabase",
    });
  } catch (err) {
    return NextResponse.json(
      { connected: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
