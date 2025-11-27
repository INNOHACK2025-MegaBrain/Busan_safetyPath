import BasicMap from "@/components/common/KakaoMap";
import Header from "@/components/layout/header";
import Menu from "@/components/layout/menu";
import FloatingMenuButton from "@/components/layout/FloatingMenuButton";

export default async function Home() {
  return (
    <div className="w-full h-screen flex flex-col">
      <Header />
      <Menu />
      <FloatingMenuButton />
      <main className="w-full flex-1 pt-16">
        <BasicMap />
      </main>
    </div>
  );
}
