import Image from "next/image";
import { supabase } from "@/lib/supabase";

export default async function Home() {
  // Supabase 연결 테스트
  let connectionStatus = "연결 실패";
  let errorMessage = null;

  try {
    const { data, error } = await supabase
      .from("_test")
      .select("count")
      .limit(1);

    if (error) {
      // 테이블이 없어도 연결은 성공한 것으로 간주
      if (
        error.code === "PGRST116" ||
        error.message.includes("relation") ||
        error.message.includes("does not exist") ||
        error.message.includes("Could not find the table") ||
        error.message.includes("schema cache")
      ) {
        connectionStatus = "✅ Supabase 연결 성공";
        errorMessage = null; // 테이블이 없는 것은 정상이므로 오류 메시지 제거
      } else {
        connectionStatus = "❌ 연결 오류";
        errorMessage = error.message;
      }
    } else {
      connectionStatus = "✅ Supabase 연결 성공";
    }
  } catch (err: any) {
    connectionStatus = "❌ 연결 실패";
    errorMessage = err.message || "알 수 없는 오류";
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={100}
          height={20}
          priority
        />
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            To get started, edit the page.tsx file.
          </h1>

          {/* Supabase 연결 상태 표시 */}
          <div className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-4">
            <h2 className="text-lg font-semibold mb-2 text-black dark:text-zinc-50">
              Supabase 연결 상태
            </h2>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              {connectionStatus}
            </p>
            {errorMessage && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                오류: {errorMessage}
              </p>
            )}
            <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-2">
              URL:{" "}
              {process.env.NEXT_PUBLIC_SUPABASE_URL ? "설정됨" : "❌ 미설정"}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-500">
              Key:{" "}
              {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
                ? "설정됨"
                : "❌ 미설정"}
            </p>
          </div>

          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Looking for a starting point or more instructions? Head over to{" "}
            <a
              href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
              className="font-medium text-zinc-950 dark:text-zinc-50"
            >
              Templates
            </a>{" "}
            or the{" "}
            <a
              href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
              className="font-medium text-zinc-950 dark:text-zinc-50"
            >
              Learning
            </a>{" "}
            center.
          </p>
        </div>
        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          <a
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-[158px]"
            href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className="dark:invert"
              src="/vercel.svg"
              alt="Vercel logomark"
              width={16}
              height={16}
            />
            Deploy Now
          </a>
          <a
            className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] md:w-[158px]"
            href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            Documentation
          </a>
        </div>
      </main>
    </div>
  );
}
