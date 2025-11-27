import BasicMap from "@/components/KakaoMap";

export default async function Home() {
  return (
    <div className="flex items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="w-full h-full">
        <BasicMap />
      </main>
    </div>
  );
}
