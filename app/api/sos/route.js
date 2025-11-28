import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import admin from "firebase-admin";

// ------------------------------------------------------------------
// 1. Firebase Admin 초기화
// ------------------------------------------------------------------
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

// ------------------------------------------------------------------
// 2. Supabase Admin 클라이언트 (RLS 우회용)
// ------------------------------------------------------------------
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL, // 환경변수명 확인 (보통 NEXT_PUBLIC_ 접두사 있음)
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is missing" },
        { status: 400 }
      );
    }

    // ------------------------------------------------------------------
    // Step A: 보낸 사람 이름 조회 (profiles 테이블이 있다면 사용, 없으면 기본값)
    // ------------------------------------------------------------------
    let senderName = "구조 요청자";
    const { data: senderData } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .single();

    if (senderData?.full_name) {
      senderName = senderData.full_name;
    }

    // ------------------------------------------------------------------
    // Step B: 보호자 찾기 (guardian_relations 테이블 사용)
    // ------------------------------------------------------------------
    // 우리가 만든 테이블: guardian_relations (child_id, guardian_id)
    const { data: relations, error: relationError } = await supabase
      .from("guardian_relations")
      .select("guardian_id")
      .eq("child_id", userId);

    if (relationError) {
      console.error("Relation Error:", relationError);
      // 테이블이 없을 수도 있으니 에러 로그만 찍고 진행 막기
      return NextResponse.json(
        { error: "보호자 관계를 조회할 수 없습니다." },
        { status: 500 }
      );
    }

    const guardianIds = relations.map((r) => r.guardian_id);

    if (guardianIds.length === 0) {
      return NextResponse.json(
        { message: "연결된 보호자가 없습니다." },
        { status: 200 }
      );
    }

    // ------------------------------------------------------------------
    // Step C: 보호자 토큰 조회 (guardians 테이블 사용)
    // ------------------------------------------------------------------
    // 우리가 만든 테이블: guardians (guardian_id, token)
    const { data: guardianTokens, error: tokenError } = await supabase
      .from("guardians")
      .select("token")
      .in("guardian_id", guardianIds);

    if (tokenError) {
      console.error("Token Error:", tokenError);
      return NextResponse.json({ error: "토큰 조회 실패" }, { status: 500 });
    }

    // 토큰 배열 추출 (null/빈값 제거)
    const tokens = guardianTokens.map((t) => t.token).filter((t) => t);

    if (tokens.length === 0) {
      return NextResponse.json(
        { message: "보호자의 알림 토큰이 없습니다." },
        { status: 200 }
      );
    }

    // ------------------------------------------------------------------
    // Step D: FCM 발송
    // ------------------------------------------------------------------
    const message = {
      tokens: tokens,
      notification: {
        title: "🚨 긴급 SOS 알림!",
        body: `${senderName}님이 긴급 구조 요청을 보냈습니다!`,
      },
      data: {
        type: "sos",
        senderId: userId,
        sentAt: new Date().toISOString(),
      },
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "sos_channel",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            contentAvailable: true,
          },
        },
      },
    };

    const fcmResponse = await admin.messaging().sendEachForMulticast(message);

    console.log(
      `SOS 발송 결과: 성공 ${fcmResponse.successCount}건 / 실패 ${fcmResponse.failureCount}건`
    );

    return NextResponse.json({
      success: true,
      sentCount: fcmResponse.successCount,
      failedCount: fcmResponse.failureCount,
    });
  } catch (error) {
    console.error("API Handler Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
