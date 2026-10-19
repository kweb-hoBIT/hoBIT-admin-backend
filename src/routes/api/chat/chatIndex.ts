import express, { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import mysql, { Pool as MysqlPool, RowDataPacket } from "mysql2/promise";
import { Pool } from "../../../../config/connectDB";
import env from "../../../../config/env";
import Request from "../../../types/Request";
import auth from "../../../middleware/auth";

/**
 * 실시간 채팅 — 관리자 사이트 쪽
 *  - 담당자 토큰 발급: 로그인 쿠키 확인 → 15분짜리 토큰 (hoBIT-backend 채팅 서버가 같은 비밀키로 확인)
 *  - 계정 역할: developer(개발자) / staff(행정실) / senior(근로장학생). 역할 기록이 없으면 staff (기존 관리자 그대로)
 *    가입할 때 쓴 키로 정함 — 개발자 키(DEVELOPER_KEY) = developer, 관리자 키(MANAGER_KEY) = staff, 근장 키(SENIOR_KEY) = senior
 *  - 역할 바꾸기: 개발자는 누구든·어떤 역할로든 / 행정실은 행정실↔근로장학생만 (개발자 계정은 못 건드림) / 자기 역할은 못 바꿈
 *  - senior 계정은 선배 FAQ·선배 채팅 관련 API만 — seniorGuard
 * 역할은 채팅 DB(hobit_beta)의 chat_agents 테이블 (hoBIT-backend와 같은 테이블)
 */
export type Role = "developer" | "staff" | "senior";
/** 채팅 서버에서 쓰는 역할 — 개발자는 행정실과 같음 */
const chatRoleOf = (r: Role): "staff" | "senior" => (r === "senior" ? "senior" : "staff");

const production = process.env.NODE_ENV === "production";
const AGENT_SECRET = process.env.CHAT_AGENT_SECRET || (production ? "" : "dev-only-CHAT_AGENT_SECRET-change-me");
if (!AGENT_SECRET) throw new Error("[chat] CHAT_AGENT_SECRET 환경 변수가 필요합니다");
const CHAT_DB = process.env.CHAT_DB_NAME || "hobit_beta";

let chatPool: Promise<MysqlPool> | null = null;
export function getChatPool(): Promise<MysqlPool> {
  if (!chatPool) {
    chatPool = (async () => {
      if (!/^[A-Za-z0-9_]+$/.test(CHAT_DB)) throw new Error("bad CHAT_DB_NAME");
      const conn = await mysql.createConnection({ host: env.DB_HOST, user: env.DB_USER, password: env.DB_PASSWORD });
      await conn.query(`CREATE DATABASE IF NOT EXISTS \`${CHAT_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      await conn.end();
      const pool = mysql.createPool({ host: env.DB_HOST, user: env.DB_USER, password: env.DB_PASSWORD, database: CHAT_DB, connectionLimit: 4 });
      await pool.query(`CREATE TABLE IF NOT EXISTS chat_agents (
        user_id INT PRIMARY KEY,
        username VARCHAR(45) NOT NULL,
        role ENUM('staff','senior','developer') NOT NULL DEFAULT 'staff',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`);
      // 예전 표(staff·senior만)에 developer 추가
      const [col] = await pool.query<RowDataPacket[]>(
        `SELECT COLUMN_TYPE AS t FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'chat_agents' AND COLUMN_NAME = 'role'`,
        [CHAT_DB]
      );
      if (col[0] && !String(col[0].t).includes("developer")) {
        await pool.query(`ALTER TABLE chat_agents MODIFY role ENUM('staff','senior','developer') NOT NULL DEFAULT 'staff'`);
      }
      return pool;
    })().catch((e) => {
      chatPool = null; // 다음 요청에서 다시 시도
      throw e;
    });
  }
  return chatPool;
}

const roleCache = new Map<number, { at: number; role: Role }>();

export async function roleOf(userId: number): Promise<Role> {
  const hit = roleCache.get(userId);
  if (hit && Date.now() - hit.at < 60_000) return hit.role;
  let role: Role = "staff"; // 역할 기록이 없는 계정 = 예전부터 있던 관리자
  try {
    const pool = await getChatPool();
    const [rows] = await pool.query<RowDataPacket[]>(`SELECT role FROM chat_agents WHERE user_id = ?`, [userId]);
    if (rows[0]?.role === "senior" || rows[0]?.role === "developer") role = rows[0].role;
  } catch (e) {
    // 조회 실패 시 행정실 권한으로 열어 주지 않음 — 마지막으로 알던 역할, 그것도 없으면 오류
    console.error("[chat] 역할 조회 실패:", (e as Error).message);
    if (hit) return hit.role;
    throw e;
  }
  roleCache.set(userId, { at: Date.now(), role });
  return role;
}

/** 역할 저장 (가입할 때·행정실이 바꿀 때) */
export async function setAgentRole(userId: number, username: string, role: Role): Promise<void> {
  const pool = await getChatPool();
  await pool.query(
    `INSERT INTO chat_agents (user_id, username, role) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE role = VALUES(role), username = VALUES(username)`,
    [userId, username, role]
  );
  roleCache.delete(userId);
}

function userIdFromCookies(req: Request): number | null {
  const token = req.cookies?.accessToken || req.cookies?.refreshToken;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { user_id?: number };
    return typeof payload.user_id === "number" ? payload.user_id : null;
  } catch {
    return null;
  }
}

// 근로장학생 계정이 쓸 수 있는 API (읽기·쓰기 모두) — 선배 FAQ·선배 FAQ 카테고리·번역·채팅·내 계정
const SENIOR_ALLOWED = [
  /^\/api\/auth(\/|$)/,
  /^\/api\/users(\/|$)/,
  /^\/api\/seniorfaqs(\/|$)/,
  /^\/api\/adminlogs\/seniorfaqlogs(\/|$)/,
  /^\/api\/translate(\/|$)/,
  /^\/api\/chat(\/|$)/,
];

/** 근로장학생 계정은 위 목록 밖의 API를 못 씀 (일반 FAQ·로그·피드백·이메일·관리자 등) — 앱 전체에 한 번 */
export async function seniorGuard(req: Request, res: Response, next: NextFunction) {
  if (req.method === "OPTIONS") return next();
  if (SENIOR_ALLOWED.some((re) => re.test(req.path))) return next();
  const uid = userIdFromCookies(req);
  if (uid === null) return next(); // 로그인 안 함 → 각 라우트의 auth가 처리
  let role: Role;
  try {
    role = await roleOf(uid);
  } catch {
    return res.status(503).json({ statusCode: 503, message: "권한을 확인하지 못했어요. 잠시 후 다시 시도해 주세요." });
  }
  if (role === "senior") {
    return res.status(403).json({ statusCode: 403, message: "근로장학생 계정은 선배 FAQ와 선배 채팅만 쓸 수 있어요." });
  }
  return next();
}

const router = express.Router();

async function usernameOf(userId: number): Promise<string | null> {
  const [rows] = await Pool.query<RowDataPacket[]>(`SELECT username FROM users WHERE id = ?`, [userId]);
  return rows[0]?.username ?? null;
}

// @route   GET api/chat/token
// @desc    채팅 서버에 붙을 담당자 토큰 (15분) + 내 역할
// @access  Private
router.get("/token", auth, async (req: Request, res: Response) => {
  const uid = Number(req.user_id);
  const name = await usernameOf(uid);
  if (!name) return res.status(401).json({ statusCode: 401, message: "User not found" });
  const accountRole = await roleOf(uid);
  const role = chatRoleOf(accountRole);
  const expiresIn = 15 * 60;
  const token = jwt.sign({ typ: "agent", uid, name, role }, AGENT_SECRET, { algorithm: "HS256", expiresIn, issuer: "hobit-chat" });
  return res.status(200).json({ statusCode: 200, message: "ok", data: { token, role, accountRole, name, user_id: uid, expiresIn } });
});

/** 행정실·개발자만 */
const staffOnly = async (req: Request, res: Response, next: NextFunction) =>
  (await roleOf(Number(req.user_id))) !== "senior" ? next() : res.status(403).json({ statusCode: 403, message: "Forbidden" });

// @route   GET api/chat/agents
// @desc    관리자 계정 목록과 채팅 역할 (행정실만)
router.get("/agents", auth, staffOnly, async (_req: Request, res: Response) => {
  const [users] = await Pool.query<RowDataPacket[]>(`SELECT id, username, email FROM users ORDER BY username`);
  const pool = await getChatPool();
  const [roles] = await pool.query<RowDataPacket[]>(`SELECT user_id, role FROM chat_agents`);
  const byId = new Map(roles.map((r) => [Number(r.user_id), r.role as Role]));
  return res.status(200).json({
    statusCode: 200,
    message: "ok",
    data: { agents: users.map((u) => ({ user_id: u.id, username: u.username, email: u.email, role: byId.get(Number(u.id)) ?? "staff" })) },
  });
});

// @route   PUT api/chat/agents/:user_id
// @desc    채팅 역할 바꾸기 (행정실만, 자기 역할은 못 바꿈 — 행정실 계정이 하나도 안 남는 일 방지)
router.put("/agents/:user_id", auth, staffOnly, async (req: Request, res: Response) => {
  const target = Number(req.params.user_id);
  const role = req.body?.role;
  if (!Number.isInteger(target) || (role !== "staff" && role !== "senior" && role !== "developer")) {
    return res.status(400).json({ statusCode: 400, message: "Invalid role" });
  }
  if (target === Number(req.user_id)) return res.status(400).json({ statusCode: 400, message: "자기 역할은 바꿀 수 없어요." });
  // 행정실은 개발자 계정을 못 건드리고, 개발자 역할도 못 줌 — 개발자만 가능
  const me = await roleOf(Number(req.user_id));
  if (me !== "developer" && (role === "developer" || (await roleOf(target)) === "developer")) {
    return res.status(403).json({ statusCode: 403, message: "개발자 계정·역할은 개발자만 바꿀 수 있어요." });
  }
  const name = await usernameOf(target);
  if (!name) return res.status(404).json({ statusCode: 404, message: "User not found" });
  await setAgentRole(target, name, role);
  return res.status(200).json({ statusCode: 200, message: "ok" });
});

export default router;
