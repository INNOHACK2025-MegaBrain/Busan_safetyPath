"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Phone,
  FileText,
  Trash2,
  ChevronRight,
  User,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUserStore } from "@/store/userStore";
import { toast } from "sonner";

interface ProfileInfo {
  name: string;
  phone: string;
  avatarUrl?: string;
}

interface EmergencyContact {
  name: string;
  relation: string;
  phone: string;
  priority?: number;
}

interface MyPagePayload {
  profile?: ProfileInfo;
  contacts?: EmergencyContact[];
}

const API_ENDPOINT = "/api/my-page";
const FALLBACK_PROFILE: ProfileInfo = {
  name: "김부산",
  phone: "010-1234-5678",
  avatarUrl: "/korean-user-avatar.jpg",
};
const FALLBACK_CONTACTS: EmergencyContact[] = [
  { name: "김영희", relation: "어머니", phone: "010-9876-5432", priority: 1 },
  { name: "이철수", relation: "친구", phone: "010-5555-6666", priority: 2 },
];

export default function MyPagePage() {
  const router = useRouter();
  const { user, signOut } = useUserStore();
  const [profile, setProfile] = useState<ProfileInfo>(FALLBACK_PROFILE);
  const [contacts, setContacts] =
    useState<EmergencyContact[]>(FALLBACK_CONTACTS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchMyPageData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 로그인된 사용자 정보 가져오기
      if (!user) {
        setError("로그인이 필요합니다.");
        setIsLoading(false);
        return;
      }

      // Supabase에서 사용자 메타데이터 가져오기
      const userMetadata = user.user_metadata || {};
      const userName =
        userMetadata.name || user.email?.split("@")[0] || "사용자";
      const userPhone = userMetadata.phone || user.phone || "";
      const userAvatar = userMetadata.avatar_url || userMetadata.avatarUrl;

      // 프로필 정보 설정
      setProfile({
        name: userName,
        phone: userPhone || FALLBACK_PROFILE.phone,
        avatarUrl: userAvatar || FALLBACK_PROFILE.avatarUrl,
      });

      // API에서 긴급 연락처 가져오기 (선택적)
      try {
        const response = await fetch(API_ENDPOINT, { cache: "no-store" });
        if (response.ok) {
          const data = (await response.json()) as MyPagePayload;
          if (data.contacts && data.contacts.length > 0) {
            setContacts(data.contacts);
          }
        }
      } catch {
        // API 실패해도 기본 연락처 사용
        console.log("API에서 연락처를 가져오지 못했습니다. 기본값 사용");
      }

      setError(null);
    } catch (err) {
      console.error("Failed to load my-page data", err);
      setError("데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMyPageData();
  }, [fetchMyPageData]);

  const hasAvatarSrc = Boolean(profile.avatarUrl);
  const fallbackInitial = profile.name ? profile.name.charAt(0) : null;

  const handleEmergencySettings = () =>
    router.push("/myPage/emergency-contacts");
  const handleReportHistory = () => router.push("/myPage/reports");
  const handleGuardians = () => router.push("/myPage/guardians");

  const handleDeleteAccount = async () => {
    if (!user) {
      toast.error("로그인이 필요합니다.");
      return;
    }

    setIsDeleting(true);
    try {
      console.log("계정 삭제 시작:", user.id);

      const response = await fetch("/api/delete-account", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: user.id }),
      });

      const data = await response.json();
      console.log("계정 삭제 응답:", { status: response.status, data });

      if (!response.ok) {
        const errorMsg = data.error || "계정 삭제에 실패했습니다.";
        console.error("계정 삭제 실패:", errorMsg, data.details);
        throw new Error(errorMsg);
      }

      console.log("계정 삭제 성공, 로그아웃 처리 중...");

      // 계정 삭제 성공 후 로그아웃 처리
      await signOut();
      setIsDeleteDialogOpen(false);

      // 홈 화면으로 리다이렉트
      router.push("/");

      // 리다이렉트 후 토스트 메시지 표시
      setTimeout(() => {
        toast.success("계정이 삭제되었습니다.");
      }, 100);
    } catch (err) {
      console.error("계정 삭제 실패:", err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : "계정 삭제 중 오류가 발생했습니다.";
      toast.error(errorMessage);
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {error && (
        <Card className="mx-4 mt-4 border-destructive/40 bg-destructive/10 text-sm text-destructive">
          <div className="flex items-center justify-between gap-3">
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={fetchMyPageData}>
              다시 시도
            </Button>
          </div>
        </Card>
      )}

      <header className="flex items-center px-4 py-3 bg-card border-b border-border">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold ml-2 text-foreground">
          마이페이지
        </h1>
      </header>

      <div className="flex-1 p-4 space-y-4">
        <Card className={`p-6 ${isLoading ? "animate-pulse" : ""}`}>
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              {hasAvatarSrc && (
                <AvatarImage
                  src={profile.avatarUrl}
                  alt={`${profile.name} 프로필 이미지`}
                />
              )}
              <AvatarFallback>
                {fallbackInitial ? (
                  <span className="text-lg font-semibold text-foreground">
                    {fallbackInitial}
                  </span>
                ) : (
                  <User className="h-10 w-10 text-muted-foreground" />
                )}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                {profile.name}
              </h2>
              <p className="text-muted-foreground">{profile.phone}</p>
            </div>
          </div>
        </Card>

        <div className="space-y-2">
          <Card
            className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={handleEmergencySettings}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Phone className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">
                    긴급 연락망 설정
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    비상시 연락할 사람 등록
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </Card>

          <Card
            className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={handleReportHistory}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">
                    최근 신고 기록 보기
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    내 신고 내역 확인
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </Card>

          <Card
            className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={handleGuardians}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">보호자 관리</h3>
                  <p className="text-sm text-muted-foreground">
                    실시간 위치 공유 대상 설정
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </Card>
        </div>

        <Card className="p-4">
          <h3 className="font-semibold text-foreground mb-3">
            등록된 긴급 연락처
          </h3>
          <div className="space-y-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">
                연락처 정보를 불러오는 중입니다...
              </p>
            ) : contacts.length ? (
              contacts.map((contact, index) => {
                const priorityLabel = `${contact.priority ?? index + 1}순위`;
                const priorityStyles =
                  index === 0
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground";

                return (
                  <div
                    key={`${contact.phone}-${contact.name}`}
                    className={`flex items-center justify-between py-2 ${
                      index === contacts.length - 1
                        ? ""
                        : "border-b border-border"
                    }`}
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        {contact.name} ({contact.relation})
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {contact.phone}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded ${priorityStyles}`}
                    >
                      {priorityLabel}
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">
                등록된 긴급 연락처가 없습니다.
              </p>
            )}
          </div>
        </Card>

        <Button
          variant="outline"
          className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 bg-transparent"
          onClick={() => setIsDeleteDialogOpen(true)}
          disabled={isLoading || isDeleting}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          계정 삭제
        </Button>
      </div>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>계정 삭제 확인</DialogTitle>
            <DialogDescription>
              정말로 계정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없으며, 모든
              데이터가 영구적으로 삭제됩니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={isDeleting}
            >
              {isDeleting ? "삭제 중..." : "계정 삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
