import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/security/api-protection";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const deletableTables = new Set([
  "class_schedules",
  "internships",
  "internship_entries",
]);

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "This request was not accepted." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    table?: unknown;
    id?: unknown;
  } | null;
  const table = typeof body?.table === "string" ? body.table : "";
  if (!body || !deletableTables.has(table) || !isUuid(body.id)) {
    return NextResponse.json({ error: "Invalid deletion request." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const { error } = await supabase
    .from("student_record_deletions")
    .upsert({
      user_id: user.id,
      table_name: table,
      record_id: body.id,
      deleted_at: new Date().toISOString(),
    });
  if (error) {
    return NextResponse.json(
      { error: "The deletion could not be synchronized." },
      { status: 500 },
    );
  }

  const { error: deleteError } = await supabase
    .from(table)
    .delete()
    .eq("id", body.id)
    .eq("user_id", user.id);
  if (deleteError) {
    return NextResponse.json(
      { error: "The record could not be deleted from Supabase." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { deleted: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
