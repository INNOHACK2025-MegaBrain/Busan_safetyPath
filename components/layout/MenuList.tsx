"use client";

import { User, Settings, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useUIStore } from "@/store/uiStore";
import { useUserStore } from "@/store/userStore";
import { toast } from "sonner";
import MenuItem from "./MenuItem";

export default function MenuList() {
  const { closeModal, openModal } = useUIStore();
  const { signOut } = useUserStore();
  const router = useRouter();

  const handleMenuItemClick = (type: string) => {
    closeModal();

    if (type === "mypage") {
      router.push("/myPage");
    } else {
      openModal(type);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success("로그아웃되었습니다");
      closeModal();
    } catch (error) {
      console.error("로그아웃 실패:", error);
      toast.error("로그아웃 중 오류가 발생했습니다");
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

      {/* 로그아웃 버튼 */}
      <div className="pt-4 border-t border-border mt-4">
        <MenuItem
          id="logout"
          label="로그아웃"
          icon={LogOut}
          onClick={handleLogout}
        />
      </div>
    </div>
  );
}
