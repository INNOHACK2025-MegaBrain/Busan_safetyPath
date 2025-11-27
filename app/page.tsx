import BasicMap from "@/components/common/KakaoMap";
import Header from "@/components/layout/header";
import Menu from "@/components/layout/menu";
import FloatingMenuButton from "@/components/layout/FloatingMenuButton";
import SearchSheet from "@/components/layout/SearchSheet";

export default async function Home() {
  return (
    <div className="w-full h-screen flex flex-col">
      <Header />
      <Menu />
      <SearchSheet />
      <FloatingMenuButton />
      <main className="w-full flex-1 pt-16">
        <BasicMap />
      </main>
    </div>
  );
}
