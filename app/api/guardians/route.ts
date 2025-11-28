import { NextResponse } from "next/server";
import {
  supabaseAdmin,
  requireAuth,
  normalizePriority,
  buildUserProfileMap,
  buildUserLabel,
  buildSosPayload,
  GuardianEntry,
  ProtectorRecord,
  unauthorizedResponse,
} from "./_helpers";

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if ("response" in auth) {
    return auth.response;
  }

  const { user } = auth;

  const { data, error } = await supabaseAdmin
    .from("protector")
    .select("*")
    .or(`requester_user_id.eq.${user.id},target_user_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[Guardians][GET] DB error", error);
    return NextResponse.json(
      { error: "보호자 정보를 불러오지 못했습니다." },
      { status: 500 }
    );
  }

  const rows = data || [];
  const profileMap = await buildUserProfileMap(
    rows.map((row) =>
      row.requester_user_id === user.id
        ? row.target_user_id
        : row.requester_user_id
    )
  );

  const guardians: GuardianEntry[] = [];
  const incomingRequests: GuardianEntry[] = [];
  const outgoingRequests: GuardianEntry[] = [];

  rows.forEach((row) => {
    const viewerIsRequester = row.requester_user_id === user.id;
    const partnerId = viewerIsRequester
      ? row.target_user_id
      : row.requester_user_id;
    const partnerProfile = partnerId ? profileMap.get(partnerId) : null;
    const partnerEmail = viewerIsRequester
      ? row.target_email
      : row.requester_email;
    const partnerName =
      partnerProfile?.name || buildUserLabel(partnerEmail, null);
    const partnerPhone = partnerProfile?.phone || null;

    const payload = {
      id: row.id,
      status: row.status,
      isRequester: viewerIsRequester,
      partner: {
        id: partnerId,
        email: partnerProfile?.email || partnerEmail,
        name: partnerName,
        phone: partnerPhone,
      },
      relation: viewerIsRequester
        ? row.requester_relation || "기타"
        : row.target_relation || row.requester_relation || "기타",
      priority: viewerIsRequester
        ? row.requester_priority ?? 99
        : row.target_priority ?? row.requester_priority ?? 99,
      created_at: row.created_at,
      responded_at: row.responded_at,
      sos: buildSosPayload(row, user),
    } satisfies GuardianEntry;

    if (row.status === "accepted") {
      guardians.push(payload);
    } else if (row.status === "pending") {
      if (viewerIsRequester) {
        outgoingRequests.push(payload);
      } else {
        incomingRequests.push(payload);
      }
    }
  });

  guardians.sort((a, b) => (a.priority || 99) - (b.priority || 99));

  return NextResponse.json({ guardians, incomingRequests, outgoingRequests });
}

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if ("response" in auth) {
    return auth.response;
  }

  const { user } = auth;

  try {
    const body = await request.json();
    const { email, relation, priority } = body as {
      email?: string;
      relation?: string;
      priority?: number;
    };

    if (!email) {
      return NextResponse.json(
        { error: "이메일을 입력해주세요." },
        { status: 400 }
      );
    }

    const {
      data: { users },
      error: listError,
    } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });

    if (listError) {
      console.error("[Guardians][POST] listUsers error", listError);
      return NextResponse.json(
        { error: "사용자 조회에 실패했습니다." },
        { status: 500 }
      );
    }

    const targetUser = users.find((u) => u.email === email);

    if (!targetUser) {
      return NextResponse.json(
        { error: "해당 이메일을 가진 사용자를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (targetUser.id === user.id) {
      return NextResponse.json(
        { error: "본인을 보호자로 등록할 수 없습니다." },
        { status: 400 }
      );
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("protector")
      .select("*")
      .or(
        `and(requester_user_id.eq.${user.id},target_user_id.eq.${targetUser.id}),and(requester_user_id.eq.${targetUser.id},target_user_id.eq.${user.id}))`
      )
      .limit(1)
      .maybeSingle();

    if (existingError && existingError.code !== "PGRST116") {
      console.error("[Guardians][POST] existing check error", existingError);
      return NextResponse.json(
        { error: "요청을 처리할 수 없습니다." },
        { status: 500 }
      );
    }

    if (existing) {
      if (existing.status === "accepted") {
        return NextResponse.json(
          { error: "이미 연결된 보호자입니다." },
          { status: 409 }
        );
      }

      if (existing.status === "pending") {
        if (existing.requester_user_id === user.id) {
          return NextResponse.json(
            { error: "이미 해당 사용자에게 요청을 보냈습니다." },
            { status: 409 }
          );
        }
        return NextResponse.json(
          { error: "상대방의 요청을 먼저 확인해주세요." },
          { status: 409 }
        );
      }

      const { error: updateError } = await supabaseAdmin
        .from("protector")
        .update({
          requester_user_id: user.id,
          requester_email: user.email,
          target_user_id: targetUser.id,
          target_email: targetUser.email,
          requester_relation: relation || "기타",
          requester_priority: normalizePriority(priority),
          status: "pending",
          responded_at: null,
        })
        .eq("id", existing.id);

      if (updateError) {
        console.error("[Guardians][POST] update error", updateError);
        return NextResponse.json(
          { error: "요청을 저장하지 못했습니다." },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, reused: true });
    }

    const { error: insertError } = await supabaseAdmin
      .from("protector")
      .insert({
        requester_user_id: user.id,
        requester_email: user.email,
        requester_relation: relation || "기타",
        requester_priority: normalizePriority(priority),
        target_user_id: targetUser.id,
        target_email: targetUser.email,
        status: "pending",
      });

    if (insertError) {
      console.error("[Guardians][POST] insert error", insertError);
      return NextResponse.json(
        { error: "요청을 저장하지 못했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Guardians][POST] unexpected error", error);
    return NextResponse.json(
      { error: "요청을 처리할 수 없습니다." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAuth(request);
  if ("response" in auth) {
    return auth.response;
  }

  const { user } = auth;

  try {
    const body = await request.json();
    const { id, action, decision } = body as {
      id?: string;
      action?: "respond";
      decision?: "accept" | "decline";
    };

    if (!id || action !== "respond" || !decision) {
      return NextResponse.json(
        { error: "잘못된 요청입니다." },
        { status: 400 }
      );
    }

    const { data: record, error } = await supabaseAdmin
      .from("protector")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !record) {
      return NextResponse.json(
        { error: "요청을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (record.target_user_id !== user.id) {
      return unauthorizedResponse;
    }

    if (record.status !== "pending") {
      return NextResponse.json(
        { error: "이미 처리된 요청입니다." },
        { status: 400 }
      );
    }

    const nextStatus = decision === "accept" ? "accepted" : "declined";
    const updatePayload: Partial<ProtectorRecord> = {
      status: nextStatus,
      responded_at: new Date().toISOString(),
    };

    if (decision === "accept") {
      Object.assign(updatePayload, {
        sos_sharing: false,
        sos_triggered_by: null,
        sos_started_at: null,
        sos_ended_at: null,
        sos_expires_at: null,
      });
    }

    const { error: updateError } = await supabaseAdmin
      .from("protector")
      .update(updatePayload)
      .eq("id", id);

    if (updateError) {
      console.error("[Guardians][PATCH] update error", updateError);
      return NextResponse.json(
        { error: "요청 처리에 실패했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, status: nextStatus });
  } catch (error) {
    console.error("[Guardians][PATCH] unexpected error", error);
    return NextResponse.json(
      { error: "요청을 처리할 수 없습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAuth(request);
  if ("response" in auth) {
    return auth.response;
  }

  const { user } = auth;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID가 필요합니다." }, { status: 400 });
  }

  const { data: record, error } = await supabaseAdmin
    .from("protector")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !record) {
    return NextResponse.json(
      { error: "데이터를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  if (
    record.requester_user_id !== user.id &&
    record.target_user_id !== user.id
  ) {
    return unauthorizedResponse;
  }

  const { error: deleteError } = await supabaseAdmin
    .from("protector")
    .delete()
    .eq("id", id);

  if (deleteError) {
    console.error("[Guardians][DELETE] delete error", deleteError);
    return NextResponse.json(
      { error: "삭제에 실패했습니다." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
