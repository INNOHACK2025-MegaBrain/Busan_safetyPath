import { NextResponse } from "next/server";
import { supabaseAdmin, requireAuth } from "../_helpers";

const SOS_TTL_MINUTES = Number(process.env.SOS_TTL_MINUTES ?? 15);

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if ("response" in auth) {
    return auth.response;
  }

  const { user } = auth;

  if (!user.email) {
    return NextResponse.json(
      { error: "이메일 정보가 없는 계정입니다." },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "요청 본문을 확인할 수 없습니다." },
      { status: 400 }
    );
  }

  const { latitude, longitude, accuracy } =
    (body as Record<string, unknown>) ?? {};

  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    Number.isNaN(latitude) ||
    Number.isNaN(longitude)
  ) {
    return NextResponse.json(
      { error: "유효한 위치 정보가 필요합니다." },
      { status: 400 }
    );
  }

  const precision =
    typeof accuracy === "number" && !Number.isNaN(accuracy) ? accuracy : null;

  const { data: links, error: linksError } = await supabaseAdmin
    .from("protector")
    .select("id")
    .eq("status", "accepted")
    .or(`requester_user_id.eq.${user.id},target_user_id.eq.${user.id}`);

  if (linksError) {
    console.error("[Guardians][sos][POST] fetch links error", linksError);
    return NextResponse.json(
      { error: "SOS 정보를 갱신하지 못했습니다." },
      { status: 500 }
    );
  }

  if (!links || links.length === 0) {
    return NextResponse.json(
      { error: "등록된 보호자가 없습니다." },
      { status: 409 }
    );
  }

  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + Math.max(SOS_TTL_MINUTES, 1) * 60 * 1000
  );

  const { error: updateError } = await supabaseAdmin
    .from("protector")
    .update({
      sos_sharing: true,
      sos_triggered_by: user.email,
      sos_latitude: latitude,
      sos_longitude: longitude,
      sos_precision_m: precision,
      sos_started_at: now.toISOString(),
      sos_ended_at: null,
      sos_expires_at: expiresAt.toISOString(),
    })
    .in(
      "id",
      links.map((row) => row.id)
    );

  if (updateError) {
    console.error("[Guardians][sos][POST] update error", updateError);
    return NextResponse.json(
      { error: "SOS 위치를 저장하지 못했습니다." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    expiresAt: expiresAt.toISOString(),
  });
}

export async function DELETE(request: Request) {
  const auth = await requireAuth(request);
  if ("response" in auth) {
    return auth.response;
  }

  const { user } = auth;

  if (!user.email) {
    return NextResponse.json({ success: true });
  }

  const nowIso = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from("protector")
    .update({
      sos_sharing: false,
      sos_ended_at: nowIso,
      sos_expires_at: nowIso,
    })
    .eq("status", "accepted")
    .eq("sos_sharing", true)
    .eq("sos_triggered_by", user.email)
    .or(`requester_user_id.eq.${user.id},target_user_id.eq.${user.id}`)
    .select("id");

  if (error) {
    console.error("[Guardians][sos][DELETE] update error", error);
    return NextResponse.json(
      { error: "SOS 공유를 종료하지 못했습니다." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
