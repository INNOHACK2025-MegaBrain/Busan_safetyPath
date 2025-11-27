"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useUIStore } from "@/store/uiStore";

export default function Menu() {
  const { isModalOpen, modalType, closeModal } = useUIStore();

  const isMenuOpen = isModalOpen && modalType === "menu";

  return (
    <Sheet open={isMenuOpen} onOpenChange={(open) => !open && closeModal()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Are you absolutely sure?</SheetTitle>
          <SheetDescription>
            This action cannot be undone. This will permanently delete your
            account and remove your data from our servers.
          </SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  );
}
