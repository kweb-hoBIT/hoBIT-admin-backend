// 관리자 로그인 시도 제한 — IP+계정 5번, IP 20번 실패 시 15분 잠금 (DB 없이)
//   npx jest tests/utils/loginLimit.test.ts
import { expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import {
  clientIp,
  loginLimiter,
  loginLockedFor,
  recordLoginFailure,
  recordLoginSuccess,
  resetLoginLimits,
} from '../../src/middleware/loginLimit';

const MIN = 60_000;
const t0 = 1_000_000_000_000;

describe('loginLimit', () => {
  beforeEach(() => resetLoginLimits());

  it('같은 IP+계정 5번 틀리면 15분 잠금, 지나면 풀림', () => {
    for (let i = 0; i < 4; i++) recordLoginFailure('1.1.1.1', 'a@korea.ac.kr', t0 + i);
    expect(loginLockedFor('1.1.1.1', 'a@korea.ac.kr', t0 + 10)).toBe(0);
    recordLoginFailure('1.1.1.1', 'A@Korea.ac.kr ', t0 + 10); // 대소문자·공백 무시
    expect(loginLockedFor('1.1.1.1', 'a@korea.ac.kr', t0 + 11)).toBeGreaterThan(14 * MIN);
    expect(loginLockedFor('1.1.1.1', 'a@korea.ac.kr', t0 + 10 + 15 * MIN)).toBe(0);
    // 다른 IP의 같은 계정은 영향 없음 (계정만으로는 잠그지 않음)
    expect(loginLockedFor('2.2.2.2', 'a@korea.ac.kr', t0 + 11)).toBe(0);
  });

  it('15분이 지난 실패는 세지 않음', () => {
    for (let i = 0; i < 4; i++) recordLoginFailure('1.1.1.1', 'b@x', t0 + i);
    recordLoginFailure('1.1.1.1', 'b@x', t0 + 16 * MIN);
    expect(loginLockedFor('1.1.1.1', 'b@x', t0 + 16 * MIN)).toBe(0);
  });

  it('성공하면 그 계정 기록을 지움', () => {
    for (let i = 0; i < 4; i++) recordLoginFailure('1.1.1.1', 'c@x', t0 + i);
    recordLoginSuccess('1.1.1.1', 'c@x');
    recordLoginFailure('1.1.1.1', 'c@x', t0 + 5);
    expect(loginLockedFor('1.1.1.1', 'c@x', t0 + 6)).toBe(0);
  });

  it('계정을 바꿔 가며 20번 틀리면 IP 전체 잠금', () => {
    for (let i = 0; i < 20; i++) recordLoginFailure('3.3.3.3', `u${i}@x`, t0 + i);
    expect(loginLockedFor('3.3.3.3', 'new@x', t0 + 30)).toBeGreaterThan(0);
  });

  it('Caddy(서버 안) 뒤에서만 X-Forwarded-For를 믿음', () => {
    const viaProxy = { socket: { remoteAddress: '127.0.0.1' }, headers: { 'x-forwarded-for': '9.9.9.9' } } as any;
    const direct = { socket: { remoteAddress: '5.5.5.5' }, headers: { 'x-forwarded-for': '127.0.0.1' } } as any;
    expect(clientIp(viaProxy)).toBe('9.9.9.9');
    expect(clientIp(direct)).toBe('5.5.5.5');
  });

  it('잠겨 있으면 429 + Retry-After, 아니면 다음으로', async () => {
    const app = express();
    app.use(express.json());
    app.post('/auth', loginLimiter, (_req, res) => res.json({ ok: true }));
    const ok = await request(app).post('/auth').send({ email: 'd@x', password: 'p' });
    expect(ok.status).toBe(200);
    // supertest는 IPv4/IPv6 루프백 중 하나로 붙음 — 셋 다 잠가 둠
    for (const ip of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) for (let i = 0; i < 5; i++) recordLoginFailure(ip, 'd@x');
    const res2 = await request(app).post('/auth').send({ email: 'd@x', password: 'p' });
    expect(res2.status).toBe(429);
    expect(res2.body.statusCode).toBe(429);
    expect(Number(res2.headers['retry-after'])).toBeGreaterThan(0);
  });
});
