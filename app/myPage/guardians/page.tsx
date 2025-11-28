"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  User,
  ShieldCheck,
  Phone as PhoneIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useUserStore } from "@/store/userStore";

interface Guardian {
  id: string;
  guardian_id: string;
  email: string;
  name: string;
  phone?: string;
  relation?: string;
  priority?: number;
  created_at: string;
}

export default function GuardiansPage() {
  const router = useRouter();
  const { checkAuth } = useUserStore();
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // 폼 상태
  const [email, setEmail] = useState("");
  const [relation, setRelation] = useState("기타");
  const [priority, setPriority] = useState("2");

  const fetchGuardians = useCallback(async () => {
    try {
      await checkAuth(); // 세션 유효성 검사

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast.error("로그인이 필요합니다.");
        router.push("/"); // 로그인 풀리면 홈으로
        return;
      }
      // ...

      const response = await fetch("/api/guardians", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // 우선순위 정렬 (1순위가 먼저)
        const sortedGuardians = (data.guardians || []).sort(
          (a: Guardian, b: Guardian) => (a.priority || 99) - (b.priority || 99)
        );
        setGuardians(sortedGuardians);
      } else {
        throw new Error("Failed to fetch guardians");
      }
    } catch (error) {
      console.error("보호자 목록 불러오기 실패:", error);
      toast.error("보호자 목록을 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [checkAuth, router]);

  useEffect(() => {
    fetchGuardians();
  }, [fetchGuardians]);

  const handleAddGuardian = async () => {
    if (!email) return;

    setIsAdding(true);
    try {
      await checkAuth(); // 세션 유효성 검사
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast.error("로그인이 필요합니다.");
        return;
      }

      const response = await fetch("/api/guardians", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email,
          relation,
          priority: parseInt(priority),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "보호자 추가 실패");
      }

      toast.success("보호자가 추가되었습니다.");

      // 폼 초기화
      setEmail("");
      setRelation("기타");
      setPriority("2");

      setIsDialogOpen(false);
      fetchGuardians();
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("보호자 추가 중 오류가 발생했습니다.");
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteGuardian = async (id: string) => {
    if (!confirm("정말로 이 보호자를 삭제하시겠습니까?")) return;

    try {
      await checkAuth(); // 세션 유효성 검사
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const response = await fetch(`/api/guardians?id=${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error("삭제 실패");
      }

      toast.success("보호자가 삭제되었습니다.");
      setGuardians((prev) => prev.filter((g) => g.id !== id));
    } catch (error) {
      console.error("삭제 오류:", error);
      toast.error("보호자 삭제에 실패했습니다.");
    }
  };

  return (
    <div className="flex flex-col h-full bg-background min-h-screen">
      <header className="flex items-center px-4 py-3 bg-card border-b border-border sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold ml-2 text-foreground">
          보호자 관리
        </h1>
      </header>

      <main className="flex-1 p-4 space-y-4">
        <div className="bg-primary/5 p-4 rounded-lg flex items-start gap-3 mb-4">
          <ShieldCheck className="h-6 w-6 text-primary shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-primary">보호자란?</h3>
            <p className="text-sm text-muted-foreground mt-1">
              등록된 보호자는 위급 상황 발생 시(SOS 요청) 귀하의 위치 정보와
              상태를 실시간으로 확인할 수 있습니다.
            </p>
          </div>
        </div>

        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold">
            등록된 보호자 ({guardians.length})
          </h2>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1">
                <Plus className="h-4 w-4" /> 보호자 추가
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>보호자 추가</DialogTitle>
                <DialogDescription>
                  보호자로 등록할 사용자의 정보를 입력해주세요.
                  <br />* 해당 사용자가 앱에 가입되어 있어야 합니다.
                </DialogDescription>
              </DialogHeader>

              <div className="py-4 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">이메일</label>
                  <Input
                    placeholder="example@email.com"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">관계</label>
                    <Select value={relation} onValueChange={setRelation}>
                      <SelectTrigger>
                        <SelectValue placeholder="관계 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="가족">가족</SelectItem>
                        <SelectItem value="친구">친구</SelectItem>
                        <SelectItem value="연인">연인</SelectItem>
                        <SelectItem value="동료">동료</SelectItem>
                        <SelectItem value="기타">기타</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">우선순위</label>
                    <Select value={priority} onValueChange={setPriority}>
                      <SelectTrigger>
                        <SelectValue placeholder="순위 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1순위</SelectItem>
                        <SelectItem value="2">2순위</SelectItem>
                        <SelectItem value="3">3순위</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isAdding}
                >
                  취소
                </Button>
                <Button
                  onClick={handleAddGuardian}
                  disabled={isAdding || !email}
                >
                  {isAdding ? "추가 중..." : "추가하기"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : guardians.length > 0 ? (
          <div className="space-y-3">
            {guardians.map((guardian) => (
              <Card
                key={guardian.id}
                className="p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center relative">
                    <User className="h-5 w-5 text-muted-foreground" />
                    {guardian.priority === 1 && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold border-2 border-background">
                        1
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">
                        {guardian.name}
                      </p>
                      <span className="text-xs px-1.5 py-0.5 bg-secondary text-secondary-foreground rounded-full">
                        {guardian.relation || "기타"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {guardian.email}
                    </p>
                    {guardian.phone && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <PhoneIcon className="h-3 w-3" /> {guardian.phone}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleDeleteGuardian(guardian.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 text-muted-foreground">
            <p>등록된 보호자가 없습니다.</p>
            <p className="text-sm mt-1">보호자를 추가하여 안전을 확보하세요.</p>
          </div>
        )}
      </main>
    </div>
  );
}
