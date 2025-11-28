import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// GET: 연락처 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Authorization 헤더에서 토큰 가져오기
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser(token);
      
      if (authError || !user) {
        return NextResponse.json(
          { error: "인증에 실패했습니다." },
          { status: 401 }
        );
      }

      // emergency_contacts 테이블에서 사용자의 연락처 조회
      const { data, error } = await supabase
        .from("emergency_contacts")
        .select("*")
        .eq("user_id", user.id)
        .order("priority", { ascending: true });

      if (error) {
        console.error("연락처 조회 오류:", error);
        return NextResponse.json(
          { error: "연락처를 불러오는데 실패했습니다." },
          { status: 500 }
        );
      }

      return NextResponse.json({ contacts: data || [] });
    }

    // 토큰이 없으면 쿠키에서 세션 확인
    const {
      data: { user: cookieUser },
      error: cookieAuthError,
    } = await supabase.auth.getUser();

    if (cookieAuthError || !cookieUser) {
      return NextResponse.json(
        { error: "인증에 실패했습니다." },
        { status: 401 }
      );
    }

    // emergency_contacts 테이블에서 사용자의 연락처 조회
    const { data, error } = await supabase
      .from("emergency_contacts")
      .select("*")
      .eq("user_id", cookieUser.id)
      .order("priority", { ascending: true });

    if (error) {
      console.error("연락처 조회 오류:", error);
      return NextResponse.json(
        { error: "연락처를 불러오는데 실패했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({ contacts: data || [] });
  } catch (error) {
    console.error("API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// POST: 새 연락처 추가
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Authorization 헤더에서 토큰 가져오기
    const authHeader = request.headers.get("authorization");
    let user;
    
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const {
        data: { user: tokenUser },
        error: authError,
      } = await supabase.auth.getUser(token);
      
      if (authError || !tokenUser) {
        return NextResponse.json(
          { error: "인증에 실패했습니다." },
          { status: 401 }
        );
      }
      user = tokenUser;
    } else {
      const {
        data: { user: cookieUser },
        error: authError,
      } = await supabase.auth.getUser();
      
      if (authError || !cookieUser) {
        return NextResponse.json(
          { error: "인증에 실패했습니다." },
          { status: 401 }
        );
      }
      user = cookieUser;
    }

    const body = await request.json();
    const { name, phone, priority, relation } = body;

    if (!name || !phone) {
      return NextResponse.json(
        { error: "이름과 전화번호는 필수입니다." },
        { status: 400 }
      );
    }

    // 우선순위가 중복되는지 확인
    const { data: existingContacts } = await supabase
      .from("emergency_contacts")
      .select("id, priority")
      .eq("user_id", user.id);

    const maxPriority = existingContacts
      ? Math.max(...existingContacts.map((c) => c.priority || 0), 0)
      : 0;

    const finalPriority = priority || maxPriority + 1;

    // 우선순위가 중복되면 기존 항목들의 우선순위 조정
    if (existingContacts?.some((c) => c.priority === finalPriority)) {
      // 우선순위가 중복되는 항목들을 하나씩 업데이트
      for (const contact of existingContacts) {
        if (contact.priority && contact.priority >= finalPriority) {
          await supabase
            .from("emergency_contacts")
            .update({ priority: contact.priority + 1 })
            .eq("id", contact.id);
        }
      }
    }

    const { data, error } = await supabase
      .from("emergency_contacts")
      .insert({
        user_id: user.id,
        name,
        phone,
        priority: finalPriority,
        relation: relation || null,
      })
      .select()
      .single();

    if (error) {
      console.error("연락처 추가 오류:", error);
      return NextResponse.json(
        { error: "연락처 추가에 실패했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({ contact: data });
  } catch (error) {
    console.error("API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

