import BasicMap from "@/components/KakaoMap";

export default async function Home() {
  return (
    <div className="w-full h-screen">
      <main className="w-full h-full">
        <BasicMap />
      </main>
    </div>
  );
}
