import { createClient, User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Supabase 환경 변수가 설정되지 않았습니다.");
}

export const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);
export const supabasePublic = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export type ProtectorRecord = {
  id: string;
  requester_user_id: string | null;
  requester_email: string | null;
  requester_relation: string | null;
  requester_priority: number | null;
  target_user_id: string | null;
  target_email: string | null;
  target_relation: string | null;
  target_priority: number | null;
  status: "pending" | "accepted" | "declined" | "revoked";
  created_at: string;
  responded_at: string | null;
  sos_sharing: boolean | null;
  sos_triggered_by: string | null;
  sos_latitude: number | null;
  sos_longitude: number | null;
  sos_precision_m: number | null;
  sos_started_at: string | null;
  sos_ended_at: string | null;
  sos_expires_at: string | null;
};

export type UserProfile = {
  id: string;
  email: string | null;
  name: string;
  phone: string | null;
};

export type SosPayload = {
  triggeredByMe: boolean;
  latitude?: number;
  longitude?: number;
  precision?: number | null;
  startedAt: string | null;
  expiresAt: string | null;
} | null;

export type GuardianEntry = {
  id: string;
  status: ProtectorRecord["status"];
  isRequester: boolean;
  partner: {
    id: string | null;
    email: string | null;
    name: string;
    phone: string | null;
  };
  relation: string;
  priority: number;
  created_at: string;
  responded_at: string | null;
  sos: SosPayload;
};

export type ActiveSosSession = {
  id: string;
  partnerId: string | null;
  partnerName: string;
  partnerEmail: string | null;
  latitude?: number;
  longitude?: number;
  precision?: number | null;
  triggeredByMe: boolean;
  startedAt: string | null;
  expiresAt: string | null;
};

export type AuthResult = { user: User } | { response: NextResponse };

export const unauthorizedResponse = NextResponse.json(
  { error: "Unauthorized" },
  { status: 401 }
);

export async function requireAuth(request: Request): Promise<AuthResult> {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) {
    return { response: unauthorizedResponse };
  }

  const {
    data: { user },
    error,
  } = await supabasePublic.auth.getUser(token);

  if (error || !user) {
    return { response: unauthorizedResponse };
  }

  return { user };
}

export function normalizePriority(value?: number | null): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 2;
  }
  return Math.min(3, Math.max(1, Math.round(value)));
}

export function buildUserLabel(
  email?: string | null,
  fallbackName?: string | null
) {
  if (fallbackName) return fallbackName;
  if (!email) return "사용자";
  return email.split("@")[0] || email;
}

export async function buildUserProfileMap(
  ids: Array<string | null | undefined>
): Promise<Map<string, UserProfile>> {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean) as string[]));
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const entries = await Promise.all(
    uniqueIds.map(async (id) => {
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(id);
      if (error || !data.user) {
        return null;
      }
      const metadata = data.user.user_metadata || {};
      return {
        id,
        email: data.user.email ?? null,
        name: metadata.name || buildUserLabel(data.user.email ?? null, null),
        phone: metadata.phone || data.user.phone || null,
      } satisfies UserProfile;
    })
  );

  const map = new Map<string, UserProfile>();
  entries.forEach((profile) => {
    if (profile) {
      map.set(profile.id, profile);
    }
  });
  return map;
}

export function buildSosPayload(
  row: ProtectorRecord,
  viewer: User
): SosPayload {
  const expiresAt = row.sos_expires_at
    ? new Date(row.sos_expires_at).getTime()
    : null;
  const stillActive =
    !!row.sos_sharing &&
    typeof row.sos_latitude === "number" &&
    typeof row.sos_longitude === "number" &&
    (!expiresAt || expiresAt > Date.now());

  if (!stillActive) {
    return null;
  }

  const triggeredByMe = row.sos_triggered_by === viewer.email;
  const latitude = triggeredByMe
    ? undefined
    : row.sos_latitude === null
    ? undefined
    : row.sos_latitude;
  const longitude = triggeredByMe
    ? undefined
    : row.sos_longitude === null
    ? undefined
    : row.sos_longitude;
  const precision = triggeredByMe ? undefined : row.sos_precision_m ?? null;
  return {
    triggeredByMe,
    latitude,
    longitude,
    precision,
    startedAt: row.sos_started_at,
    expiresAt: row.sos_expires_at,
  };
}
