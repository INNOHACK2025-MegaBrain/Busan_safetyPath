"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function resolveServiceWorkerRegistration() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  const existingRegistration = await navigator.serviceWorker.getRegistration();
  if (existingRegistration) return existingRegistration;

  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

async function ensurePushSubscription(registration: ServiceWorkerRegistration) {
  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    return existing;
  }

  if (!VAPID_PUBLIC_KEY) {
    throw new Error(
      "NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY 환경 변수가 설정되지 않았습니다."
    );
  }

  const convertedKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: convertedKey,
  });
}

function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (nextValue: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled}
      onClick={() => {
        if (disabled) return;
        onChange(!checked);
      }}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-[#2563eb]/40 focus-visible:ring-offset-2",
        checked ? "bg-[#2563eb]" : "bg-muted",
        disabled && "opacity-60"
      )}
    >
      <span
        className={cn(
          "absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}

interface ToggleRowProps {
  label: string;
  value: boolean;
  onChange: (nextValue: boolean) => void;
  isLast?: boolean;
  disabled?: boolean;
}

function ToggleRow({
  label,
  value,
  onChange,
  isLast,
  disabled,
}: ToggleRowProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-6 py-4",
        !isLast && "border-b border-border/70"
      )}
    >
      <p className="text-base font-medium text-foreground">{label}</p>
      <ToggleSwitch checked={value} onChange={onChange} disabled={disabled} />
    </div>
  );
}

interface LinkRowProps {
  label: string;
  onClick: () => void;
  isLast?: boolean;
}

function LinkRow({ label, onClick, isLast }: LinkRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between px-6 py-4 text-left",
        !isLast && "border-b border-border/70"
      )}
    >
      <span className="text-base font-medium text-foreground">{label}</span>
      <ChevronRight className="h-5 w-5 text-muted-foreground" />
    </button>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [locationConsent, setLocationConsent] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const goBack = () => router.back();
  const openPrivacyPolicy = () => router.push("/myPage/legal/privacy");
  const openOpenSource = () => router.push("/myPage/legal/open-source");

  useEffect(() => {
    let isMounted = true;
    let geoPermissionStatus: PermissionStatus | null = null;

    const hydrateFromBrowserPermissions = async () => {
      try {
        if (typeof window === "undefined") return;

        if ("Notification" in window) {
          let shouldEnablePush = Notification.permission === "granted";

          if (shouldEnablePush) {
            try {
              const registration = await resolveServiceWorkerRegistration();
              if (registration) {
                const subscription =
                  await registration.pushManager.getSubscription();
                shouldEnablePush = Boolean(subscription) || shouldEnablePush;
              }
            } catch (err) {
              console.warn("푸시 구독 상태를 확인할 수 없습니다.", err);
            }
          }

          if (isMounted) {
            setPushEnabled(shouldEnablePush);
          }
        }

        const permissions = navigator.permissions;
        if (permissions?.query) {
          try {
            geoPermissionStatus = await permissions.query({
              name: "geolocation" as PermissionName,
            });

            if (!isMounted) return;
            if (geoPermissionStatus.state === "granted") {
              setLocationConsent(true);
            }

            geoPermissionStatus.onchange = () => {
              if (!isMounted || !geoPermissionStatus) return;
              setLocationConsent(geoPermissionStatus.state === "granted");
            };
          } catch (err) {
            console.warn("위치 권한 상태를 확인할 수 없습니다.", err);
          }
        }
      } finally {
        if (isMounted) {
          setIsInitialLoading(false);
        }
      }
    };

    hydrateFromBrowserPermissions();

    return () => {
      isMounted = false;
      if (geoPermissionStatus) {
        geoPermissionStatus.onchange = null;
      }
    };
  }, []);

  const handlePushToggle = async (nextValue: boolean) => {
    if (pushBusy) return;
    setPushError(null);
    setPushBusy(true);

    setPushEnabled(nextValue);

    try {
      if (nextValue) {
        if (typeof window === "undefined" || !("Notification" in window)) {
          throw new Error("이 브라우저에서는 푸시 알림을 지원하지 않습니다.");
        }

        if (Notification.permission === "default") {
          const permission = await Notification.requestPermission();
          if (permission !== "granted") {
            throw new Error("푸시 알림 권한이 허용되지 않았습니다.");
          }
        } else if (Notification.permission !== "granted") {
          throw new Error("브라우저 설정에서 푸시 알림이 차단되었습니다.");
        }

        const registration = await resolveServiceWorkerRegistration();
        if (!registration) {
          throw new Error(
            "서비스 워커가 등록된 환경에서만 푸시 알림을 켤 수 있습니다."
          );
        }

        await ensurePushSubscription(registration);
        // 실제 푸시 구독 로직을 여기서 처리하세요.
      } else {
        const registration = await resolveServiceWorkerRegistration();
        const subscription = await registration?.pushManager.getSubscription();
        await subscription?.unsubscribe();
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "푸시 알림 설정 중 문제가 발생했습니다.";
      setPushError(message);
    } finally {
      setPushBusy(false);
    }
  };

  const handleLocationToggle = async (nextValue: boolean) => {
    if (locationBusy) return;
    setLocationError(null);
    setLocationBusy(true);

    setLocationConsent(nextValue);

    try {
      if (nextValue) {
        if (typeof window === "undefined" || !navigator.geolocation) {
          throw new Error("이 브라우저에서는 위치 정보를 사용할 수 없습니다.");
        }

        await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (position) => resolve(position),
            (err) => {
              reject(
                new Error(err.message || "위치 정보를 가져오지 못했습니다.")
              );
            },
            { timeout: 10000 }
          );
        });
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "위치 정보 설정 중 문제가 발생했습니다.";
      setLocationError(message);
    } finally {
      setLocationBusy(false);
    }
  };

  const pushDisabled = isInitialLoading || pushBusy;
  const locationDisabled = isInitialLoading || locationBusy;
  const pushStatusText = pushEnabled
    ? "푸시 알림이 켜져 있습니다."
    : "푸시 알림이 꺼져 있습니다.";
  const locationStatusText = locationConsent
    ? "위치 정보 수집에 동의했습니다."
    : "위치 정보 수집에 동의하지 않았습니다.";

  return (
    <div className="flex min-h-screen flex-col bg-muted/20 text-foreground">
      <header className="flex items-center gap-2 border-b border-border bg-card px-4 py-3 shadow-sm">
        <Button
          variant="ghost"
          size="icon"
          aria-label="뒤로가기"
          onClick={goBack}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">설정</h1>
      </header>

      <main className="flex-1 space-y-6 px-4 py-6">
        {isInitialLoading && (
          <p className="text-sm text-muted-foreground">
            기본 설정을 불러오는 중입니다...
          </p>
        )}
        <section className="overflow-hidden rounded-3xl border border-border bg-card text-foreground shadow-sm">
          <ToggleRow
            label="푸시 알림"
            value={pushEnabled}
            onChange={handlePushToggle}
            disabled={pushDisabled}
          />
          {!pushBusy && !pushError && (
            <p className="px-6 pb-3 text-xs text-muted-foreground">
              {pushStatusText}
            </p>
          )}
          {pushBusy && (
            <p className="px-6 pb-3 text-xs text-muted-foreground">
              푸시 설정을 저장하는 중입니다...
            </p>
          )}
          {pushError && (
            <p className="px-6 pb-3 text-sm text-destructive">{pushError}</p>
          )}
          <ToggleRow
            label="위치 정보 수집 동의"
            value={locationConsent}
            onChange={handleLocationToggle}
            isLast
            disabled={locationDisabled}
          />
          {!locationBusy && !locationError && (
            <p className="px-6 pb-3 text-xs text-muted-foreground">
              {locationStatusText}
            </p>
          )}
          {locationBusy && (
            <p className="px-6 pb-3 text-xs text-muted-foreground">
              위치 동의를 확인하는 중입니다...
            </p>
          )}
          {locationError && (
            <p className="px-6 pb-3 text-sm text-destructive">
              {locationError}
            </p>
          )}
        </section>

        <section className="overflow-hidden rounded-3xl border border-border bg-card text-foreground shadow-sm">
          <LinkRow label="개인정보 처리 방침" onClick={openPrivacyPolicy} />
          <LinkRow label="오픈소스 라이선스" onClick={openOpenSource} isLast />
        </section>
      </main>
    </div>
  );
}
