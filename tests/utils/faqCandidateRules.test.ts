// FAQ 후보 규칙 — 정규화·예전 자동 피드백 문구·대표 문장·원래 문장 합치기·AI 응답 읽기·RAG 없이 묶기 (DB 없이)
//   npx jest tests/utils/faqCandidateRules.test.ts
import { expect } from '@jest/globals';
import {
  groupByExactText,
  isTrivialQuestion,
  mergeSamples,
  normalizeQuestion,
  parseAutoFeedbackDetail,
  parseFilterResponse,
  parseSamples,
  pickRepresentative,
} from '../../src/utils/faqCandidateRules';

describe('faqCandidateRules', () => {
  it('정규화 — 띄어쓰기·문장부호·대소문자만 다르면 같음', () => {
    expect(normalizeQuestion(' 휴학 신청 방법?? ')).toBe(normalizeQuestion('휴학신청방법'));
    expect(normalizeQuestion('TOEIC 점수!')).toBe('toeic점수');
    expect(isTrivialQuestion(' ? ')).toBe(true);
    expect(isTrivialQuestion('a')).toBe(true);
    expect(isTrivialQuestion('휴학')).toBe(false);
  });

  it('예전 자동 피드백 문구에서 질문만', () => {
    expect(parseAutoFeedbackDetail("'정보대학 건물을 빌리고 싶어' 질문을 추가해주세요!")).toBe('정보대학 건물을 빌리고 싶어');
    expect(parseAutoFeedbackDetail("'it's 따옴표' 질문을 추가해주세요!")).toBe("it's 따옴표");
    expect(parseAutoFeedbackDetail('학생이 직접 쓴 피드백')).toBeNull();
    expect(parseAutoFeedbackDetail("'?' 질문을 추가해주세요!")).toBeNull();
  });

  it('대표 문장 — 많이 나온 것, 같으면 짧은 것', () => {
    expect(pickRepresentative(['기숙사 신청 기간 알려줘', '기숙사 언제', '기숙사 신청 기간 알려줘'])).toBe('기숙사 신청 기간 알려줘');
    expect(pickRepresentative(['기숙사 신청 기간 알려줘', '기숙사 언제'])).toBe('기숙사 언제');
    expect(pickRepresentative(['휴학 방법?', '휴학방법', '복학'])).toBe('휴학방법');
  });

  it('원래 문장 — 같은 글자는 최근 것 하나, 최근 순 최대 개수', () => {
    const old = [
      { text: '휴학 방법', language: 'KO', at: '2026-11-01T00:00:00.000Z' },
      { text: 'how to take leave', language: 'EN', at: '2026-11-02T00:00:00.000Z' },
    ];
    const added = [{ text: '휴학방법?', language: 'KO', at: '2026-11-08T00:00:00.000Z' }];
    const merged = mergeSamples(old, added);
    expect(merged.map((s) => s.text)).toEqual(['휴학방법?', 'how to take leave']);
    const many = Array.from({ length: 12 }, (_, i) => ({ text: `질문 ${i}`, language: 'KO', at: `2026-11-${String(i + 1).padStart(2, '0')}` }));
    expect(mergeSamples([], many, 8)).toHaveLength(8);
    expect(mergeSamples([], many, 8)[0].text).toBe('질문 11');
    expect(parseSamples('not json')).toEqual([]);
    expect(parseSamples(JSON.stringify(old))).toHaveLength(2);
  });

  it('AI 응답 — 못 읽으면 그대로 남기고, 빠진 번호도 남김', () => {
    const inputs = ['욕설', 'How do I apply for a dorm?', '휴학 방법'];
    expect(parseFilterResponse('oops', inputs)).toEqual(inputs.map((q) => ({ keep: true, ko: q })));
    const raw = JSON.stringify({ items: [{ i: 0, keep: false, ko: '욕설' }, { i: 1, keep: true, ko: '기숙사 신청은 어떻게 해?' }] });
    expect(parseFilterResponse(raw, inputs)).toEqual([
      { keep: false, ko: '욕설' },
      { keep: true, ko: '기숙사 신청은 어떻게 해?' },
      { keep: true, ko: '휴학 방법' },
    ]);
    expect(parseFilterResponse(JSON.stringify({ items: [{ i: 0, keep: true, ko: '' }] }), ['원문'])).toEqual([{ keep: true, ko: '원문' }]);
  });

  it('RAG 없이 — 글자가 같은 것만 기존 후보에 붙이고 나머지는 같은 글자끼리', () => {
    const out = groupByExactText(['휴학 방법?', '복학 방법', '복학방법', '졸업'], [{ id: 9, question: '휴학방법' }]);
    expect(out).toEqual([
      { existing_id: 9, cluster: null },
      { existing_id: null, cluster: 0 },
      { existing_id: null, cluster: 0 },
      { existing_id: null, cluster: 1 },
    ]);
  });
});
