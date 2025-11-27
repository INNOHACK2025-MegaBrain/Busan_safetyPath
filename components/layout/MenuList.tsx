"use client";

import { User, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { useUIStore } from "@/store/uiStore";
import MenuItem from "./MenuItem";

export default function MenuList() {
  const { closeModal, openModal } = useUIStore();
  const router = useRouter();

  const handleMenuItemClick = (type: string) => {
    closeModal();

    if (type === "mypage") {
      router.push("/myPage");
    } else {
      openModal(type);
    }
  };

  const menuItems = [
    {
      id: "mypage",
      label: "마이페이지",
      icon: User,
      onClick: () => handleMenuItemClick("mypage"),
    },
    {
      id: "settings",
      label: "설정",
      icon: Settings,
      onClick: () => handleMenuItemClick("settings"),
    },
  ];

  return (
    <div className="mt-6 space-y-2">
      {menuItems.map((item) => (
        <MenuItem
          key={item.id}
          id={item.id}
          label={item.label}
          icon={item.icon}
          onClick={item.onClick}
        />
      ))}
    </div>
  );
}
