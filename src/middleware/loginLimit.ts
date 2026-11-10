import { NextFunction, Request, Response } from "express";

/**
 * 관리자 로그인 시도 제한 — 비밀번호를 계속 바꿔 넣는 공격(무작위 대입)을 막음.
 *   같은 IP + 같은 계정: 15분 안에 5번 틀리면 15분 잠금
 *   같은 IP (계정 무관):  15분 안에 20번 틀리면 15분 잠금 — 계정을 바꿔 가며 시도하는 경우
 * 로그인에 성공하면 그 IP+계정 기록은 지움. 계정만으로는 잠그지 않음 (남이 일부러 틀려 관리자를 못 들어오게 하는 것 방지).
 * 서버 메모리에 셈 (pm2 1개) — 서버를 다시 켜면 초기화됨.
 */
const WINDOW_MS = 15 * 60_000;
const LOCK_MS = 15 * 60_000;
const ACCOUNT_LIMIT = 5;
const IP_LIMIT = 20;

type Bucket = { fails: number[]; lockedUntil: number };
const buckets = new Map<string, Bucket>();

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

/** 요청 IP — 배포는 Caddy(같은 서버) 뒤라, 연결이 서버 안에서 왔을 때만 X-Forwarded-For의 마지막 주소를 믿음 */
export function clientIp(req: Request): string {
  const remote = req.socket?.remoteAddress ?? "";
  const fwd = req.headers["x-forwarded-for"];
  if (LOOPBACK.has(remote) && typeof fwd === "string" && fwd.trim()) {
    const parts = fwd.split(",").map((s) => s.trim()).filter(Boolean);
    return parts[parts.length - 1] ?? remote;
  }
  return remote || "-";
}

const keys = (ip: string, email: string) => ({
  account: `a:${ip}:${String(email ?? "").trim().toLowerCase().slice(0, 200)}`,
  ip: `i:${ip}`,
});

function bucket(key: string, now: number): Bucket {
  let b = buckets.get(key);
  if (!b) {
    b = { fails: [], lockedUntil: 0 };
    buckets.set(key, b);
  }
  b.fails = b.fails.filter((t) => now - t < WINDOW_MS);
  return b;
}

/** 잠겨 있으면 남은 ms, 아니면 0 */
export function loginLockedFor(ip: string, email: string, now = Date.now()): number {
  const k = keys(ip, email);
  const until = Math.max(buckets.get(k.account)?.lockedUntil ?? 0, buckets.get(k.ip)?.lockedUntil ?? 0);
  return until > now ? until - now : 0;
}

export function recordLoginFailure(ip: string, email: string, now = Date.now()) {
  const k = keys(ip, email);
  const a = bucket(k.account, now);
  a.fails.push(now);
  if (a.fails.length >= ACCOUNT_LIMIT) {
    a.lockedUntil = now + LOCK_MS;
    a.fails = [];
  }
  const i = bucket(k.ip, now);
  i.fails.push(now);
  if (i.fails.length >= IP_LIMIT) {
    i.lockedUntil = now + LOCK_MS;
    i.fails = [];
  }
}

export function recordLoginSuccess(ip: string, email: string) {
  buckets.delete(keys(ip, email).account);
}

/** 테스트용 */
export function resetLoginLimits() {
  buckets.clear();
}

/** 로그인 라우트 앞에 — 잠겨 있으면 비밀번호 확인 없이 429 */
export function loginLimiter(req: Request, res: Response, next: NextFunction) {
  const left = loginLockedFor(clientIp(req), req.body?.email);
  if (!left) return next();
  const sec = Math.ceil(left / 1000);
  res.setHeader("Retry-After", String(sec));
  return res.status(429).json({
    statusCode: 429,
    message: "Too many login attempts. Please try again later.",
    retry_after_sec: sec,
  });
}

// 오래된 기록 정리 (10분마다)
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) {
    b.fails = b.fails.filter((t) => now - t < WINDOW_MS);
    if (!b.fails.length && b.lockedUntil <= now) buckets.delete(k);
  }
}, 600_000).unref();
