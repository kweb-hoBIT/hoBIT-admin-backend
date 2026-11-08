// FAQ 엑셀 왕복 확인 — 엑셀 만들기 → 다시 읽기 → DB와 비교 (DB 없이)
//   npx jest tests/utils/faqExcel.test.ts
import ExcelJS from 'exceljs';
import { expect } from '@jest/globals';
import {
  buildFaqXlsx,
  buildImportPlan,
  cellText,
  DbFaqRow,
  makeOrderAssigner,
  parseFaqXlsx,
  SHEET_NAME,
} from '../../src/utils/faqExcel';

const card = (answer: string, url = '', email = '', phone = '') => ({ answer, url, email, phone });

const fixture: DbFaqRow[] = [
  {
    id: 10,
    maincategory_ko: '학적',
    maincategory_en: 'Academic Records',
    subcategory_ko: '휴학/복학',
    subcategory_en: 'Leave/Return',
    question_ko: '휴학은 어떻게 해?',
    question_en: 'How do I take a leave?',
    answer_ko: JSON.stringify([
      card('포털에서 신청해요.\n기간을 꼭 확인하세요.', 'https://portal.korea.ac.kr', 'info@korea.ac.kr', '02-3290-4000'),
      card('군휴학은 따로 신청해요.', 'https://example.com/army'),
    ]),
    answer_en: JSON.stringify([
      card('Apply on the portal.\nCheck the period.', 'https://portal.korea.ac.kr', 'info@korea.ac.kr', '02-3290-4000'),
      card('Military leave is separate.', 'https://example.com/army'),
    ]),
    manager: '김호빗 🐰',
    audience: 'undergraduate',
    category_order: 2,
    subcategory_order: 1,
  },
  {
    id: 11,
    maincategory_ko: '대학원',
    maincategory_en: 'Graduate School',
    subcategory_ko: '대학원',
    subcategory_en: 'Graduate School',
    question_ko: '대학원 행정실은 어디야?',
    question_en: 'Where is the graduate office?',
    answer_ko: JSON.stringify([card('정보대학 201호예요.', '', '', '0232904000')]),
    answer_en: JSON.stringify([card('Room 201.', '', '', '0232904000')]),
    manager: '이담당',
    audience: null, // 칸이 없던 때 → 처음 규칙(대학원)
    category_order: 3,
    subcategory_order: 1,
  },
  {
    id: 12,
    maincategory_ko: 'ETC',
    maincategory_en: 'ETC',
    subcategory_ko: '예비군',
    subcategory_en: 'Reserve Forces',
    question_ko: '예비군 훈련 공결 돼?',
    question_en: 'Is reserve training excused?',
    answer_ko: JSON.stringify([card('네, 증빙을 내면 돼요.'), card('담당 교수님께도 알려요.'), card('기간은 학기마다 달라요.')]),
    answer_en: JSON.stringify([card('Yes, with proof.'), card('Tell your professor.'), card('Varies by semester.')]),
    manager: '박담당',
    audience: 'all',
    category_order: 9,
    subcategory_order: 2,
  },
];

async function rewrite(buf: Buffer, edit: (ws: ExcelJS.Worksheet) => void): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as any);
  edit(wb.getWorksheet(SHEET_NAME)!);
  return Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}

const findRow = (ws: ExcelJS.Worksheet, id: number) => {
  for (let r = 2; r <= ws.rowCount; r++) if (Number(ws.getRow(r).getCell(1).value) === id) return r;
  throw new Error(`no row ${id}`);
};

describe('FAQ 엑셀 왕복', () => {
  it('만든 엑셀을 그대로 읽으면 바뀐 게 없어요', async () => {
    const buf = await buildFaqXlsx(fixture);

    // 링크 칸 하나를 하이퍼링크 칸으로 바꿔도 같은 값으로 읽혀야 함
    const withLink = await rewrite(buf, (ws) => {
      const r = findRow(ws, 10);
      ws.getRow(r).getCell(11).value = { text: 'https://portal.korea.ac.kr', hyperlink: 'https://portal.korea.ac.kr' };
      // 질문 칸에 전각 공백·보이지 않는 글자·여러 칸 띄움이 섞여도 같은 질문
      ws.getRow(r).getCell(7).value = { richText: [{ text: '휴학은　어떻게  ' }, { text: '해?​' }] };
    });

    const parsed = await parseFaqXlsx(withLink);
    const plan = buildImportPlan(parsed, fixture);
    console.log('왕복:', JSON.stringify({ problems: plan.problems, warnings: plan.warnings, unchanged: plan.unchanged }));

    expect(parsed.faqs).toHaveLength(3);
    expect(parsed.faqs[0].view.cards).toHaveLength(2);
    expect(parsed.faqs[0].view.cards[0].answer).toBe('포털에서 신청해요.\n기간을 꼭 확인하세요.');
    expect(parsed.faqs[0].view.manager).toBe('김호빗 🐰');
    expect(parsed.faqs[1].view.audience).toBe('graduate');
    expect(parsed.faqs[1].view.cards[0].phone).toBe('0232904000');
    expect(parsed.faqs[2].view.cards).toHaveLength(3);
    expect(plan.problems).toEqual([]);
    expect(plan.created).toEqual([]);
    expect(plan.deleted).toEqual([]);
    // 11번은 DB에 대상이 없어 규칙으로 '대학원'이 됨 → 엑셀도 대학원이라 바뀐 것 없음
    expect(plan.updated).toEqual([]);
    expect(plan.unchanged).toBe(3);
    expect(plan.missingFromFile).toEqual([]);
  });

  it('칸 고치기 · 답변 두 개짜리 새 FAQ · 삭제 · 빠진 줄', async () => {
    const buf = await buildFaqXlsx(fixture);
    const edited = await rewrite(buf, (ws) => {
      // 10번: 두 번째 답변 고치고 영어는 비움 → 자동 번역 대상
      const r10 = findRow(ws, 10);
      ws.getRow(r10 + 1).getCell(9).value = '군휴학은 병무청 서류가 필요해요.';
      ws.getRow(r10 + 1).getCell(10).value = null;
      // 12번: 삭제
      ws.getRow(findRow(ws, 12)).getCell(15).value = '삭제';
      // 11번: 줄을 통째로 지움 → 그대로 둠
      ws.spliceRows(findRow(ws, 11), 1);
      // 새 FAQ (답변 2개, 기존 소분류와 띄어쓰기만 다른 이름)
      const last = ws.rowCount;
      ws.getRow(last + 1).values = ['', '공통', '학적', '', '휴학 / 복학', '', '복학 신청은 언제 해?', '', '학기 시작 전에 해요.', '', 'https://example.com/return', '', '', '김호빗'];
      ws.getRow(last + 2).values = ['', '', '', '', '', '', '', '', '방학 중에만 받아요.', 'Only during vacation.'];
    });

    const parsed = await parseFaqXlsx(edited);
    const plan = buildImportPlan(parsed, fixture, { autoTranslate: true });
    console.log(
      '수정:',
      JSON.stringify(
        {
          created: plan.created.map((c) => ({ row: c.row, q: c.view.question_ko, en: c.view.maincategory_en, cards: c.view.cards })),
          updated: plan.updated.map((u) => ({ id: u.id, changes: u.changes })),
          deleted: plan.deleted.map((d) => d.id),
          unchanged: plan.unchanged,
          missing: plan.missingFromFile,
          problems: plan.problems,
          warnings: plan.warnings,
          translateCount: plan.translateCount,
        },
        null,
        1
      )
    );

    expect(plan.problems).toEqual([]);
    expect(plan.updated).toHaveLength(1);
    expect(plan.updated[0].id).toBe(10);
    expect(plan.updated[0].changes.map((c) => c.label)).toEqual(['답변 2', '답변(영어) 2']);
    expect(plan.updated[0].changes[1].auto_translate).toBe(true);
    expect(plan.created).toHaveLength(1);
    expect(plan.created[0].view.audience).toBe('all');
    expect(plan.created[0].view.maincategory_en).toBe('Academic Records'); // 기존 대분류 영어 이름으로 채움
    expect(plan.created[0].view.cards).toHaveLength(2);
    expect(plan.created[0].view.cards[1]).toEqual({ answer: '방학 중에만 받아요.', answer_en: 'Only during vacation.', url: '', email: '', phone: '' });
    expect(plan.deleted.map((d) => d.id)).toEqual([12]);
    expect(plan.missingFromFile).toEqual([11]);
    expect(plan.unchanged).toBe(0);
    expect(plan.warnings.some((w) => w.message.includes("기존 '휴학/복학' 과 비슷해요"))).toBe(true);

    // 새 소분류는 그 대분류의 맨 뒤
    const order = makeOrderAssigner(fixture);
    expect(order('학적', '휴학 / 복학')).toEqual({ category_order: 2, subcategory_order: 2 });
    expect(order('새 대분류', '새 소분류')).toEqual({ category_order: 10, subcategory_order: 1 });
  });

  it('막아야 하는 문제', async () => {
    const buf = await buildFaqXlsx(fixture);
    const edited = await rewrite(buf, (ws) => {
      ws.getRow(findRow(ws, 11)).getCell(2).value = '학생';  // 모르는 대상
      ws.getRow(findRow(ws, 12)).getCell(1).value = 999; // 없는 번호
      const last = ws.rowCount;
      ws.getRow(last + 1).values = [10, '학부', '학적', '', '휴학/복학', '', '다른 질문', '', '답', '', '', '', '', '']; // 번호 10이 두 번
      ws.getRow(last + 2).values = ['', '학부', '학적', '', '휴학/복학', '', '대학원 행정실은 어디야?', '', '답', '', '', '', '', '']; // 같은 질문
      ws.getRow(last + 3).values = ['', '학부', '', '', '', '', 'x'.repeat(301), '', '', '', '', '', '', '']; // 빈 칸·너무 긴 질문
    });
    const plan = buildImportPlan(await parseFaqXlsx(edited), fixture);
    console.log('문제:', JSON.stringify(plan.problems, null, 1));
    const msgs = plan.problems.map((p) => p.message).join('\n');
    expect(msgs).toContain("(지금: '학생')");
    expect(msgs).toContain('번호 999인 FAQ가 없어요');
    expect(msgs).toContain('같은 번호(10)가');
    expect(msgs).toContain('질문과 똑같아요');
    expect(msgs).toContain('대분류가 비어 있어요');
    expect(msgs).toContain('답변이 비어 있어요');
    expect(msgs).toContain('너무 길어요');
  });

  it('칸 값 종류', () => {
    expect(cellText(232904000)).toBe('232904000');
    expect(cellText({ formula: 'A1', result: 'x' } as any)).toBe('x');
    expect(cellText({ text: '', hyperlink: 'mailto:a@b.c' } as any)).toBe('a@b.c');
    expect(cellText({ text: { richText: [{ text: 'a' }, { text: 'b' }] }, hyperlink: 'http://x' } as any)).toBe('ab');
    expect(cellText({ error: '#N/A' } as any)).toBe('');
  });
});
