"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, Edit2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserStore } from "@/store/userStore";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface EmergencyContact {
  id?: string;
  name: string;
  phone: string;
  priority: number;
  relation?: string;
}

export default function EmergencyContactsPage() {
  const router = useRouter();
  const { user } = useUserStore();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<EmergencyContact | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newContact, setNewContact] = useState<EmergencyContact>({
    name: "",
    phone: "",
    priority: 1,
    relation: "",
  });

  const fetchContacts = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Supabase에서 세션 토큰 가져오기
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch("/api/emergency-contacts", {
        cache: "no-store",
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {},
      });

      if (response.ok) {
        const data = await response.json();
        setContacts(data.contacts || []);
      } else {
        console.error("연락처 불러오기 실패");
      }
    } catch (error) {
      console.error("연락처 불러오기 오류:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleAdd = async () => {
    if (!newContact.name || !newContact.phone) {
      toast.error("이름과 전화번호를 입력해주세요.");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch("/api/emergency-contacts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(newContact),
      });

      if (response.ok) {
        toast.success("보호자가 추가되었습니다.");
        setIsAdding(false);
        setNewContact({ name: "", phone: "", priority: 1, relation: "" });
        fetchContacts();
      } else {
        const error = await response.json();
        toast.error(error.message || "보호자 추가에 실패했습니다.");
      }
    } catch (error) {
      console.error("보호자 추가 오류:", error);
      toast.error("보호자 추가 중 오류가 발생했습니다.");
    }
  };

  const handleUpdate = async (contact: EmergencyContact) => {
    if (!contact.id || !contact.name || !contact.phone) {
      toast.error("이름과 전화번호를 입력해주세요.");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`/api/emergency-contacts/${contact.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(contact),
      });

      if (response.ok) {
        toast.success("보호자 정보가 수정되었습니다.");
        setEditingId(null);
        fetchContacts();
      } else {
        const error = await response.json();
        toast.error(error.message || "보호자 수정에 실패했습니다.");
      }
    } catch (error) {
      console.error("보호자 수정 오류:", error);
      toast.error("보호자 수정 중 오류가 발생했습니다.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("정말로 이 보호자를 삭제하시겠습니까?")) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`/api/emergency-contacts/${id}`, {
        method: "DELETE",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (response.ok) {
        toast.success("보호자가 삭제되었습니다.");
        fetchContacts();
      } else {
        const error = await response.json();
        toast.error(error.message || "보호자 삭제에 실패했습니다.");
      }
    } catch (error) {
      console.error("보호자 삭제 오류:", error);
      toast.error("보호자 삭제 중 오류가 발생했습니다.");
    }
  };

  const handlePriorityChange = async (
    contactId: string,
    newPriority: number
  ) => {
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) return;

    // 우선순위가 이미 사용 중인지 확인
    const existingContact = contacts.find(
      (c) => c.id !== contactId && c.priority === newPriority
    );

    if (existingContact) {
      // 기존 우선순위를 교환
      const updatedContacts = contacts.map((c) => {
        if (c.id === contactId) {
          return { ...c, priority: newPriority };
        }
        if (c.id === existingContact.id) {
          return { ...c, priority: contact.priority };
        }
        return c;
      });

        // 두 연락처 모두 업데이트
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;

          await Promise.all([
            fetch(`/api/emergency-contacts/${contactId}`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({ ...contact, priority: newPriority }),
            }),
            fetch(`/api/emergency-contacts/${existingContact.id}`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({
                ...existingContact,
                priority: contact.priority,
              }),
            }),
          ]);

        toast.success("우선순위가 변경되었습니다.");
        fetchContacts();
      } catch (error) {
        console.error("우선순위 변경 오류:", error);
        toast.error("우선순위 변경 중 오류가 발생했습니다.");
      }
    } else {
      // 우선순위가 비어있으면 바로 업데이트
      handleUpdate({ ...contact, priority: newPriority });
    }
  };

  const sortedContacts = [...contacts].sort((a, b) => a.priority - b.priority);

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="flex items-center px-4 py-3 bg-card border-b border-border">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold ml-2 text-foreground">
          긴급 연락망 설정
        </h1>
      </header>

      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {/* 추가 버튼 */}
        {!isAdding && (
          <Button
            onClick={() => setIsAdding(true)}
            className="w-full"
            variant="outline"
          >
            <Plus className="h-4 w-4 mr-2" />
            보호자 추가
          </Button>
        )}

        {/* 추가 폼 */}
        {isAdding && (
          <Card className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">새 보호자 추가</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setIsAdding(false);
                  setNewContact({ name: "", phone: "", priority: 1, relation: "" });
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="new-name">이름 *</Label>
                <Input
                  id="new-name"
                  value={newContact.name}
                  onChange={(e) =>
                    setNewContact({ ...newContact, name: e.target.value })
                  }
                  placeholder="보호자 이름"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-phone">전화번호 *</Label>
                <Input
                  id="new-phone"
                  type="tel"
                  value={newContact.phone}
                  onChange={(e) =>
                    setNewContact({ ...newContact, phone: e.target.value })
                  }
                  placeholder="010-1234-5678"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-relation">관계</Label>
                <Input
                  id="new-relation"
                  value={newContact.relation || ""}
                  onChange={(e) =>
                    setNewContact({ ...newContact, relation: e.target.value })
                  }
                  placeholder="예: 어머니, 아버지, 친구"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-priority">우선순위</Label>
                <Input
                  id="new-priority"
                  type="number"
                  min="1"
                  max={contacts.length + 1}
                  value={newContact.priority}
                  onChange={(e) =>
                    setNewContact({
                      ...newContact,
                      priority: parseInt(e.target.value) || 1,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  숫자가 작을수록 우선순위가 높습니다 (1순위가 최우선)
                </p>
              </div>

              <Button onClick={handleAdd} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                저장
              </Button>
            </div>
          </Card>
        )}

        {/* 연락처 목록 */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            연락처를 불러오는 중...
          </div>
        ) : sortedContacts.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              등록된 보호자가 없습니다.
              <br />
              위의 "보호자 추가" 버튼을 눌러 추가해주세요.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {sortedContacts.map((contact) => {
              const isEditing = editingId === contact.id;

              return (
                <Card key={contact.id} className="p-4">
                  {isEditing && editData ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-primary">
                          {contact.priority}순위
                        </span>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingId(null);
                              setEditData(null);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleUpdate(editData)}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="space-y-1">
                          <Label htmlFor={`edit-name-${contact.id}`}>이름</Label>
                          <Input
                            id={`edit-name-${contact.id}`}
                            value={editData.name}
                            onChange={(e) =>
                              setEditData({ ...editData, name: e.target.value })
                            }
                          />
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor={`edit-phone-${contact.id}`}>
                            전화번호
                          </Label>
                          <Input
                            id={`edit-phone-${contact.id}`}
                            type="tel"
                            value={editData.phone}
                            onChange={(e) =>
                              setEditData({ ...editData, phone: e.target.value })
                            }
                          />
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor={`edit-relation-${contact.id}`}>
                            관계
                          </Label>
                          <Input
                            id={`edit-relation-${contact.id}`}
                            value={editData.relation || ""}
                            onChange={(e) =>
                              setEditData({
                                ...editData,
                                relation: e.target.value,
                              })
                            }
                          />
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor={`edit-priority-${contact.id}`}>
                            우선순위
                          </Label>
                          <Input
                            id={`edit-priority-${contact.id}`}
                            type="number"
                            min="1"
                            max={contacts.length}
                            value={editData.priority}
                            onChange={(e) => {
                              const newPriority = parseInt(e.target.value) || 1;
                              setEditData({ ...editData, priority: newPriority });
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-primary bg-primary/10 px-2 py-1 rounded">
                            {contact.priority}순위
                          </span>
                          <h3 className="font-semibold text-foreground">
                            {contact.name}
                          </h3>
                          {contact.relation && (
                            <span className="text-sm text-muted-foreground">
                              ({contact.relation})
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingId(contact.id || null);
                              setEditData({ ...contact });
                            }}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => contact.id && handleDelete(contact.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">
                          {contact.phone}
                        </p>
                      </div>

                      {/* 우선순위 변경 */}
                      <div className="flex items-center gap-2 pt-2 border-t border-border">
                        <Label className="text-xs text-muted-foreground">
                          우선순위:
                        </Label>
                        <select
                          value={contact.priority}
                          onChange={(e) =>
                            contact.id &&
                            handlePriorityChange(
                              contact.id,
                              parseInt(e.target.value)
                            )
                          }
                          className="text-xs border border-border rounded px-2 py-1 bg-background"
                        >
                          {contacts.map((_, index) => (
                            <option key={index + 1} value={index + 1}>
                              {index + 1}순위
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

