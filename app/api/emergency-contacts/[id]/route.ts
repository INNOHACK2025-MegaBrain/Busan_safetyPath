import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// PUT: 연락처 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // 기존 연락처 정보 가져오기
    const { data: existingContact, error: fetchError } = await supabase
      .from("emergency_contacts")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !existingContact) {
      return NextResponse.json(
        { error: "연락처를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 우선순위가 변경된 경우 처리
    if (priority && priority !== existingContact.priority) {
      const { data: allContacts } = await supabase
        .from("emergency_contacts")
        .select("id, priority")
        .eq("user_id", user.id)
        .neq("id", id);

      const conflictingContact = allContacts?.find(
        (c) => c.priority === priority
      );

      if (conflictingContact) {
        // 우선순위 교환
        await supabase
          .from("emergency_contacts")
          .update({ priority: existingContact.priority })
          .eq("id", conflictingContact.id);
      } else {
        // 우선순위 범위 조정
        if (priority < existingContact.priority) {
          // 우선순위가 올라감 (숫자가 작아짐)
          const { data: contactsToUpdate } = await supabase
            .from("emergency_contacts")
            .select("id, priority")
            .eq("user_id", user.id)
            .gte("priority", priority)
            .lt("priority", existingContact.priority)
            .neq("id", id);

          if (contactsToUpdate) {
            for (const contact of contactsToUpdate) {
              await supabase
                .from("emergency_contacts")
                .update({ priority: (contact.priority || 0) + 1 })
                .eq("id", contact.id);
            }
          }
        } else {
          // 우선순위가 내려감 (숫자가 커짐)
          const { data: contactsToUpdate } = await supabase
            .from("emergency_contacts")
            .select("id, priority")
            .eq("user_id", user.id)
            .gt("priority", existingContact.priority)
            .lte("priority", priority)
            .neq("id", id);

          if (contactsToUpdate) {
            for (const contact of contactsToUpdate) {
              await supabase
                .from("emergency_contacts")
                .update({ priority: (contact.priority || 0) - 1 })
                .eq("id", contact.id);
            }
          }
        }
      }
    }

    const { data, error } = await supabase
      .from("emergency_contacts")
      .update({
        name,
        phone,
        priority: priority || existingContact.priority,
        relation: relation || null,
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("연락처 수정 오류:", error);
      return NextResponse.json(
        { error: "연락처 수정에 실패했습니다." },
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

// DELETE: 연락처 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // 기존 연락처 정보 가져오기 (우선순위 조정을 위해)
    const { data: existingContact } = await supabase
      .from("emergency_contacts")
      .select("priority")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    // 연락처 삭제
    const { error } = await supabase
      .from("emergency_contacts")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("연락처 삭제 오류:", error);
      return NextResponse.json(
        { error: "연락처 삭제에 실패했습니다." },
        { status: 500 }
      );
    }

    // 삭제된 연락처보다 우선순위가 낮은 항목들의 우선순위 조정
    if (existingContact && existingContact.priority) {
      const { data: contactsToUpdate } = await supabase
        .from("emergency_contacts")
        .select("id, priority")
        .eq("user_id", user.id)
        .gt("priority", existingContact.priority);

      if (contactsToUpdate) {
        for (const contact of contactsToUpdate) {
          await supabase
            .from("emergency_contacts")
            .update({ priority: (contact.priority || 0) - 1 })
            .eq("id", contact.id);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

