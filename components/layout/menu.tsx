"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useUIStore } from "@/store/uiStore";
import MenuList from "./MenuList";

export default function Menu() {
  const { isModalOpen, modalType, closeModal } = useUIStore();

  const isMenuOpen = isModalOpen && modalType === "menu";

  return (
    <Sheet open={isMenuOpen} onOpenChange={(open) => !open && closeModal()}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>메뉴</SheetTitle>
          <SheetDescription>원하는 메뉴를 선택하세요</SheetDescription>
        </SheetHeader>
        <MenuList />
      </SheetContent>
    </Sheet>
  );
}
