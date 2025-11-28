"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";

interface LicenseItem {
  name: string;
  license: string;
  description: string;
  homepage?: string;
}

export default function OpenSourceLicensePage() {
  const router = useRouter();

  const libraries = useMemo<LicenseItem[]>(
    () => [
      {
        name: "Next.js",
        license: "MIT License",
        description:
          "React 기반 웹 애플리케이션 프레임워크로, 본 서비스의 UI와 라우팅을 구성합니다.",
        homepage: "https://github.com/vercel/next.js",
      },
      {
        name: "React",
        license: "MIT License",
        description: "컴포넌트 기반 UI를 구축하기 위한 핵심 라이브러리입니다.",
        homepage: "https://github.com/facebook/react",
      },
      {
        name: "Supabase JS",
        license: "Apache License 2.0",
        description:
          "실시간 데이터베이스와 인증을 간편하게 사용하도록 돕는 SDK입니다.",
        homepage: "https://github.com/supabase/supabase-js",
      },
      {
        name: "Lucide React",
        license: "ISC License",
        description:
          "아이콘 컴포넌트 모음으로, 서비스 전반에 아이콘 UI를 제공합니다.",
        homepage: "https://github.com/lucide-icons/lucide",
      },
      {
        name: "Tailwind CSS",
        license: "MIT License",
        description:
          "Utility-first 스타일 프레임워크로 UI 스타일링에 사용됩니다.",
        homepage: "https://github.com/tailwindlabs/tailwindcss",
      },
      {
        name: "react-kakao-maps-sdk",
        license: "MIT License",
        description:
          "카카오 지도 SDK를 React에서 간편하게 사용할 수 있도록 하는 라이브러리입니다.",
        homepage: "https://github.com/JaeSeoKim/react-kakao-maps-sdk",
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
          <h1 className="text-lg font-semibold">오픈소스 라이선스</h1>
          <p className="text-xs text-muted-foreground">
            본 서비스는 다음 오픈소스 소프트웨어를 사용합니다.
          </p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {libraries.map((library) => (
            <article
              key={library.name}
              className="rounded-3xl border border-border bg-card p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold">{library.name}</h2>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  {library.license}
                </span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {library.description}
              </p>
              {library.homepage && (
                <a
                  href={library.homepage}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  프로젝트 페이지 바로가기
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </article>
          ))}

          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground">
            위 라이브러리들은 각 라이선스 조건을 따르며, 저작권은 해당
            저작권자에게 있습니다. 라이선스 전문이 필요한 경우 공식 저장소를
            참고하시기 바랍니다.
          </div>
        </div>
      </main>
    </div>
  );
}
