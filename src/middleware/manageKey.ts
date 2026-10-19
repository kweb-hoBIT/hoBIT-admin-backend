import crypto from "crypto";
import jwt from "jsonwebtoken";
import env from "../../config/env";

/** 쉼표로 나눈 키 목록 중 정확히 같은 것이 있는지 (길이까지 같은 키만, 비교 시간 일정) */
function matches(given: unknown, keys: string | undefined): boolean {
  if (typeof given !== "string" || !given) return false;
  const g = Buffer.from(given);
  return (keys ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean)
    .some((k) => {
      const key = Buffer.from(k);
      return key.length === g.length && crypto.timingSafeEqual(key, g);
    });
}

/**
 * 가입 키 → 역할: 개발자 키(DEVELOPER_KEY) = developer, 관리자 키(MANAGER_KEY) = 행정실(staff), 근장 키(SENIOR_KEY) = 근로장학생(senior), 그 외 null
 * 예전 `env.MANAGER_KEY.includes(manageKey)`는 빈 문자열·키의 일부도 통과시켰음
 */
export function roleForKey(manageKey: unknown): "developer" | "staff" | "senior" | null {
  if (matches(manageKey, env.DEVELOPER_KEY)) return "developer";
  if (matches(manageKey, env.MANAGER_KEY)) return "staff";
  if (matches(manageKey, env.SENIOR_KEY)) return "senior";
  return null;
}

/** 둘 중 아무 키나 맞으면 true */
export function isValidManageKey(manageKey: unknown): boolean {
  return roleForKey(manageKey) !== null;
}

/** 비밀번호 재설정 토큰 — /users/find에서 관리자 키·본인 정보 확인 후 발급, 10분 */
const RESET_PURPOSE = "password-reset";

export function signResetToken(user_id: number): string {
  return jwt.sign({ user_id, purpose: RESET_PURPOSE }, env.JWT_SECRET, { expiresIn: 600 });
}

export function verifyResetToken(token: unknown): number | null {
  if (typeof token !== "string" || !token) return null;
  try {
    const p: any = jwt.verify(token, env.JWT_SECRET);
    return p?.purpose === RESET_PURPOSE && Number.isInteger(p.user_id) ? p.user_id : null;
  } catch {
    return null;
  }
}
