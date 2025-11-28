import { NextResponse } from "next/server";
import {
  supabaseAdmin,
  requireAuth,
  buildUserProfileMap,
  buildUserLabel,
  ActiveSosSession,
} from "../_helpers";

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if ("response" in auth) {
    return auth.response;
  }

  const { user } = auth;

  const { data, error } = await supabaseAdmin
    .from("protector")
    .select("*")
    .eq("status", "accepted")
    .eq("sos_sharing", true)
    .or(`requester_user_id.eq.${user.id},target_user_id.eq.${user.id}`)
    .order("sos_started_at", { ascending: false });

  if (error) {
    console.error("[Guardians][active-sos] DB error", error);
    return NextResponse.json(
      { error: "SOS 정보를 불러오지 못했습니다." },
      { status: 500 }
    );
  }

  const now = Date.now();
  const activeRows = (data || []).filter((row) => {
    if (!row.sos_expires_at) {
      return false;
    }
    const expiresAt = Date.parse(row.sos_expires_at);
    return Number.isFinite(expiresAt) && expiresAt > now;
  });

  if (activeRows.length === 0) {
    return NextResponse.json({ sessions: [] });
  }

  const ownerIds = activeRows.map((row) => {
    const triggeredByRequester =
      !!row.sos_triggered_by &&
      !!row.requester_email &&
      row.sos_triggered_by === row.requester_email;
    return triggeredByRequester ? row.requester_user_id : row.target_user_id;
  });
  const ownerProfiles = await buildUserProfileMap(ownerIds);

  const sessions: ActiveSosSession[] = activeRows.map((row) => {
    const triggeredByRequester =
      !!row.sos_triggered_by &&
      !!row.requester_email &&
      row.sos_triggered_by === row.requester_email;
    const ownerId = triggeredByRequester
      ? row.requester_user_id
      : row.target_user_id;
    const ownerEmail = triggeredByRequester
      ? row.requester_email
      : row.target_email;
    const ownerProfile = ownerId ? ownerProfiles.get(ownerId) : null;
    const displayName = buildUserLabel(
      ownerProfile?.email ?? ownerEmail,
      ownerProfile?.name || null
    );
    const triggeredByMe = row.sos_triggered_by === user.email;

    const session: ActiveSosSession = {
      id: row.id,
      partnerId: ownerId,
      partnerName: displayName,
      partnerEmail: ownerProfile?.email || ownerEmail,
      triggeredByMe,
      startedAt: row.sos_started_at,
      expiresAt: row.sos_expires_at,
    };

    if (!triggeredByMe) {
      if (
        typeof row.sos_latitude === "number" &&
        typeof row.sos_longitude === "number" &&
        !Number.isNaN(row.sos_latitude) &&
        !Number.isNaN(row.sos_longitude)
      ) {
        session.latitude = row.sos_latitude;
        session.longitude = row.sos_longitude;
      }
      if (
        typeof row.sos_precision_m === "number" ||
        row.sos_precision_m === null
      ) {
        session.precision = row.sos_precision_m;
      }
    }

    return session;
  });

  return NextResponse.json({ sessions });
}
