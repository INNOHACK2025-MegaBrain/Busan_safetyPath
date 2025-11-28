"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

interface PolicySection {
  title: string;
  description?: string;
  bullets?: string[];
}

export default function PrivacyPolicyPage() {
  const router = useRouter();

  const sections = useMemo<PolicySection[]>(
    () => [
      {
        title: "1. 총칙",
        bullets: [
          "부산 안전길(이하 '서비스')은 개인정보보호법 등 관련 법령을 준수합니다.",
          "본 방침은 서비스 웹·모바일 이용 전체에 적용됩니다.",
        ],
      },
      {
        title: "2. 수집 항목 및 방법",
        bullets: [
          "회원가입: 이름, 휴대전화번호, 로그인 식별자(이메일 또는 소셜 ID)",
          "서비스 이용: 위치 정보(좌표, 이동 경로), 긴급 연락처 정보, 신고 기록, 기기 정보",
          "자동 수집: 접속 IP, 브라우저/OS, 쿠키, 푸시 토큰, 이용 로그",
          "수집 경로: 이용자 입력, 서비스 이용 과정, 로그 분석 도구",
        ],
      },
      {
        title: "3. 이용 목적",
        bullets: [
          "사용자 인증 및 안전 경로 추천",
          "긴급 알림·푸시 메시지 발송",
          "신고 내역 확인 및 관계 기관 전달",
          "서비스 품질 향상, 통계·분석, 보안 이상 탐지",
          "법령 준수 및 분쟁 대응",
        ],
      },
      {
        title: "4. 보유 및 이용 기간",
        bullets: [
          "회원 탈퇴 시 즉시 삭제하되, 관련 법령에 따라 필요한 경우 별도 보관 후 파기합니다.",
          "전자상거래법 등 관계 법령에서 정한 기간(예: 5년) 동안 보존할 수 있습니다.",
          "위치 정보는 목적 달성 즉시 비식별화하거나 삭제합니다.",
        ],
      },
      {
        title: "5. 제3자 제공",
        bullets: [
          "이용자 동의 또는 법령 근거가 있는 경우에 한해 경찰서, 부산시 재난안전대책본부 등 관계 기관에 최소 정보만 제공합니다.",
          "제공 시 제공받는 자, 목적, 항목, 보유 기간을 이용자에게 고지합니다.",
        ],
      },
      {
        title: "6. 처리위탁",
        bullets: [
          "클라우드 호스팅, 푸시 발송, 데이터 분석 등 일부 업무를 위탁할 수 있으며 계약으로 개인정보 보호 의무를 부과합니다.",
        ],
      },
      {
        title: "7. 이용자 권리",
        bullets: [
          "언제든지 개인정보 열람·정정·삭제·처리정지를 요청할 수 있습니다.",
          "요청 방법: 앱 내 문의 또는 privacy@busansafetypath.kr (051-000-0000).",
          "법정대리인은 만 14세 미만 이용자의 권리를 행사할 수 있습니다.",
        ],
      },
      {
        title: "8. 위치정보 처리",
        bullets: [
          "위치 정보는 안전 경로 안내, 신고 위치 기록, 치안 정보 제공에만 사용됩니다.",
          "사용자는 브라우저/앱 권한 설정에서 위치 수집을 거부할 수 있으며 이 경우 일부 기능이 제한됩니다.",
        ],
      },
      {
        title: "9. 정보 보호 대책",
        bullets: [
          "전송 구간 암호화(HTTPS)와 접근 권한 최소화를 적용합니다.",
          "데이터 암호화, 침입 탐지, 정기적 취약점 점검 등을 수행합니다.",
          "비밀번호와 민감 정보는 안전한 방식으로 저장합니다.",
        ],
      },
      {
        title: "10. 국외 이전",
        bullets: [
          "해외 클라우드를 이용할 수 있으며, 이전 국가·항목·관리 방안을 사전 고지하고 동의를 받습니다.",
        ],
      },
      {
        title: "11. 개인정보 보호책임자",
        bullets: [
          "책임자: 김OO (Busan Safety Path 팀)",
          "연락처: privacy@busansafetypath.kr / 051-000-0000",
        ],
      },
      {
        title: "12. 개정 안내",
        bullets: [
          "정책 변경 시 시행 7일 전 서비스 공지로 알리며, 중대한 변경 시 30일 전 별도 동의를 받습니다.",
        ],
      },
    ],
    []
  );

  return (
    <div className="flex min-h-screen flex-col bg-muted/30 text-foreground">
      <header className="sticky top-0 flex items-center gap-3 border-b border-border bg-card/95 px-4 py-3 shadow-sm backdrop-blur">
        <Button
          variant="ghost"
          size="icon"
          aria-label="뒤로가기"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold">개인정보 처리 방침</h1>
          <p className="text-xs text-muted-foreground">
            시행일: 2025-11-01 / 버전 1.0
          </p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-6 rounded-3xl border border-border bg-card p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">
            부산 안전길은 이용자의 소중한 개인정보를 보호하기 위해 아래와 같은
            방침을 운영합니다. 서비스 이용 시 본 방침에 동의한 것으로
            간주됩니다.
          </p>

          {sections.map((section) => (
            <section key={section.title} className="space-y-3">
              <h2 className="text-base font-semibold">{section.title}</h2>
              {section.description && (
                <p className="text-sm text-muted-foreground">
                  {section.description}
                </p>
              )}
              {section.bullets && (
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {section.bullets.map((bullet) => (
                    <li key={bullet} className="list-inside list-disc">
                      {bullet}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <div className="rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">
            본 방침은 서비스 및 관련 법령 변화에 따라 수정될 수 있으며, 변경 시
            공지를 통해 안내드리겠습니다.
          </div>
        </div>
      </main>
    </div>
  );
}
