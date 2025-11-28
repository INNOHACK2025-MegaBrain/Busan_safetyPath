import { NextResponse } from "next/server";
import {
  buildUserLabel,
  buildUserProfileMap,
  requireAuth,
  supabaseAdmin,
} from "../guardians/_helpers";

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if ("response" in auth) {
    return auth.response;
  }

  const { user } = auth;

  const { data, error } = await supabaseAdmin
    .from("protector")
    .select("*")
    .or(
      `and(status.eq.accepted,requester_user_id.eq.${user.id}),and(status.eq.accepted,target_user_id.eq.${user.id})`
    )
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[MyPage][GET] protector query failed", error);
    return NextResponse.json(
      { error: "보호자 정보를 불러오지 못했습니다." },
      { status: 500 }
    );
  }

  const rows = data || [];
  const partnerIds = rows.map((row) =>
    row.requester_user_id === user.id
      ? row.target_user_id
      : row.requester_user_id
  );
  const profileMap = await buildUserProfileMap(partnerIds);

  const contacts = rows
    .map((row) => {
      const viewerIsRequester = row.requester_user_id === user.id;
      const partnerId = viewerIsRequester
        ? row.target_user_id
        : row.requester_user_id;
      const partnerProfile = partnerId ? profileMap.get(partnerId) : null;
      const partnerEmail = viewerIsRequester
        ? row.target_email
        : row.requester_email;
      const name = partnerProfile?.name || buildUserLabel(partnerEmail, null);
      const phone = partnerProfile?.phone || "";
      const relation = viewerIsRequester
        ? row.requester_relation || row.target_relation || "보호자"
        : row.target_relation || row.requester_relation || "보호자";
      const priority = viewerIsRequester
        ? row.requester_priority ?? row.target_priority ?? 99
        : row.target_priority ?? row.requester_priority ?? 99;

      return {
        id: row.id,
        name,
        relation,
        phone,
        priority,
      };
    })
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));

  return NextResponse.json({ contacts });
}
