import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    // Service Role Key 확인
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("SUPABASE_SERVICE_ROLE_KEY is missing");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    // 1. Service Role Key로 Admin Client 생성 (auth.users 접근용)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 2. 현재 로그인한 사용자 확인
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 3. Guardians 테이블 조회
    const { data: guardians, error: dbError } = await supabaseAdmin
      .from("guardians")
      .select("*")
      .eq("user_id", user.id);

    if (dbError) {
      console.error("DB Error fetching guardians:", dbError);
      throw dbError;
    }

    // 4. Guardian ID로 사용자 정보(이메일 등) 조회
    const guardianDetails = await Promise.all(
      guardians.map(async (g) => {
        const { data: guardianUser, error: userError } = await supabaseAdmin.auth.admin.getUserById(g.guardian_id);
        
        if (userError || !guardianUser.user) {
          return { ...g, email: "알 수 없음", name: "알 수 없음" };
        }

        // 메타데이터에서 이름이나 전화번호 가져오기
        const meta = guardianUser.user.user_metadata || {};
        return {
          ...g,
          email: guardianUser.user.email,
          name: meta.name || guardianUser.user.email?.split("@")[0] || "사용자",
          phone: meta.phone || guardianUser.user.phone, // DB에 저장된 phone 대신 user의 phone 사용 (최신 정보)
        };
      })
    );

    return NextResponse.json({ guardians: guardianDetails });
  } catch (error) {
    console.error("Error fetching guardians:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, relation, priority } = body;

    console.log(`[Guardians] Adding guardian: ${email}, relation: ${relation}, priority: ${priority}`);

    if (!email) {
      return NextResponse.json({ error: "이메일을 입력해주세요." }, { status: 400 });
    }

    // Service Role Key 확인
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("SUPABASE_SERVICE_ROLE_KEY is missing");
      return NextResponse.json({ error: "서버 설정 오류: 관리자 키가 없습니다." }, { status: 500 });
    }

    // 1. Admin Client 생성
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 2. 현재 사용자 확인
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
        return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      console.error("Auth error:", authError);
      return NextResponse.json({ error: "로그인 정보를 확인할 수 없습니다." }, { status: 401 });
    }

    // 3. 이메일로 보호자(대상 유저) 찾기
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000
    });
    
    if (listError) {
        console.error("List users error:", listError);
        throw listError;
    }

    const guardianUser = users.find(u => u.email === email);

    if (!guardianUser) {
      console.log(`[Guardians] User not found for email: ${email}`);
      return NextResponse.json({ error: "해당 이메일을 가진 사용자를 찾을 수 없습니다. 앱에 가입된 사용자만 등록 가능합니다." }, { status: 404 });
    }

    if (guardianUser.id === user.id) {
        return NextResponse.json({ error: "본인을 보호자로 등록할 수 없습니다." }, { status: 400 });
    }

    // 4. 이미 등록된 보호자인지 확인
    const { data: existing, error: checkError } = await supabaseAdmin
        .from("guardians")
        .select("*")
        .eq("user_id", user.id)
        .eq("guardian_id", guardianUser.id)
        .maybeSingle();
    
    if (checkError) {
        console.error("Check existing guardian error:", checkError);
        throw checkError;
    }
    
    if (existing) {
        return NextResponse.json({ error: "이미 등록된 보호자입니다." }, { status: 409 });
    }

    // 보호자의 전화번호 가져오기 (메타데이터 우선)
    const guardianPhone = guardianUser.user_metadata?.phone || guardianUser.phone || null;

    // 5. 등록
    const { error: insertError } = await supabaseAdmin
      .from("guardians")
      .insert({
        user_id: user.id,
        guardian_id: guardianUser.id,
        relation: relation || "기타",
        priority: priority || 2,
        phone: guardianPhone // 보호자의 전화번호도 함께 저장 (스냅샷 용도)
      });

    if (insertError) {
        console.error("Insert guardian error:", insertError);
        throw insertError;
    }

    console.log(`[Guardians] Successfully added guardian: ${guardianUser.id} for user: ${user.id}`);
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Error adding guardian:", error);
    const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json({ error: "서버 오류가 발생했습니다.", details: errorMessage }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            console.error("SUPABASE_SERVICE_ROLE_KEY is missing");
            return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
        }

        // 1. Admin Client
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // 2. 권한 확인
        const token = request.headers.get("authorization")?.replace("Bearer ", "");
        const supabaseAuth = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 3. 삭제
        const { error } = await supabaseAdmin
            .from("guardians")
            .delete()
            .eq("id", id)
            .eq("user_id", user.id);

        if (error) throw error;

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Error deleting guardian:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
