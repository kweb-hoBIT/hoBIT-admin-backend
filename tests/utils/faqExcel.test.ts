// hoBIT 데이터 엑셀 왕복 확인 — 엑셀 만들기 → 다시 읽기 → DB와 비교 (DB 없이)
//   npx jest tests/utils/faqExcel.test.ts
import ExcelJS from 'exceljs';
import { expect } from '@jest/globals';
import {
  buildImportPlan,
  cellText,
  DbFaqRow,
  dbRowToView,
  FAQ_SHEETS,
  LEGACY_COLUMNS,
  makeOrderAssigner,
  parseFaqSheet,
  SHEET_NAME,
} from '../../src/utils/faqExcel';
import { AUDIENCE_LABEL } from '../../src/utils/faqAudience';
import { LEGACY_SENIOR_COLUMNS, makeSeniorOrderAssigner, SeniorDbRow, seniorRowToView } from '../../src/utils/seniorFaqExcel';
import {
  buildHobitPlan,
  buildHobitXlsx,
  collectEmails,
  EMAIL_SHEET,
  MANAGER_SHEET,
  parseHobitXlsx,
  replaceEmailInField,
} from '../../src/utils/hobitWorkbook';

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
  {
    id: 13,
    maincategory_ko: '수업',
    maincategory_en: 'Classes',
    subcategory_ko: '수강신청',
    subcategory_en: 'Registration',
    question_ko: '수강신청은 언제야?',
    question_en: 'When is registration?',
    answer_ko: JSON.stringify([card('학사일정을 확인해요.', 'https://registrar.korea.ac.kr')]),
    answer_en: JSON.stringify([card('Check the calendar.', 'https://registrar.korea.ac.kr')]),
    manager: '박담당',
    audience: 'undergraduate',
    category_order: 1,
    subcategory_order: 1,
  },
  {
    id: 14,
    maincategory_ko: '장학',
    maincategory_en: 'Scholarship',
    subcategory_ko: '교내장학',
    subcategory_en: 'On-campus',
    question_ko: '장학금 신청은 어디서 해?',
    question_en: 'Where do I apply for scholarships?',
    answer_ko: JSON.stringify([card('포털 장학 메뉴에서 해요.'), card('마감일을 지켜요.')]),
    answer_en: JSON.stringify([card('On the portal.'), card('Mind the deadline.')]),
    manager: '이담당',
    audience: 'undergraduate',
    category_order: 4,
    subcategory_order: 1,
  },
];

const seniorCard = (title: string, answer: string, url = '', lat = '', lng = '') => ({ title, answer, url, map: { latitude: lat, longitude: lng } });
const seniorFixture: SeniorDbRow[] = [
  {
    id: 2,
    maincategory_ko: '수강신청',
    maincategory_en: 'Course Registration',
    subcategory_ko: '일반',
    subcategory_en: 'General',
    detailcategory_ko: '기간',
    detailcategory_en: 'Duration',
    answer_ko: JSON.stringify([seniorCard('기간', '보통 2월, 8월이야.\n학사일정을 봐 😀', 'https://registrar.korea.ac.kr')]),
    answer_en: JSON.stringify([seniorCard('Duration', 'Usually Feb and Aug.', 'https://registrar.korea.ac.kr')]),
    manager: '김호빗 🐰',
    category_order: 1,
    subcategory_order: 1,
    detailcategory_order: 1,
  },
  {
    id: 3,
    maincategory_ko: '수강신청',
    maincategory_en: 'Course Registration',
    subcategory_ko: '일반',
    subcategory_en: 'General',
    detailcategory_ko: '방법',
    detailcategory_en: 'Methods',
    answer_ko: JSON.stringify([seniorCard('방법', '수희등부터 해.'), seniorCard('방법', '정정은 같은 사이트야.', 'https://sugang.korea.ac.kr', '37.58', '127.02')]),
    answer_en: JSON.stringify([seniorCard('Methods', 'Wishlist first.'), seniorCard('Method', 'Same site.', 'https://sugang.korea.ac.kr', '37.58', '127.02')]),
    manager: 'kwebhobit',
    category_order: 1,
    subcategory_order: 1,
    detailcategory_order: 2,
  },
];
// 답변 4개짜리 선배 FAQ (묶음이 4개로 늘고 4번째는 접혀야 함)
const seniorFour: SeniorDbRow = {
  id: 4,
  maincategory_ko: '생활',
  maincategory_en: 'Life',
  subcategory_ko: '식당',
  subcategory_en: 'Dining',
  detailcategory_ko: '학식',
  detailcategory_en: 'Cafeteria',
  answer_ko: JSON.stringify([1, 2, 3, 4].map((i) => seniorCard(`식당${i}`, `${i}번 식당이야.`, '', `37.5${i}`, `127.0${i}`))),
  answer_en: JSON.stringify([1, 2, 3, 4].map((i) => seniorCard(`Cafe ${i}`, `Cafe no. ${i}.`, '', `37.5${i}`, `127.0${i}`))),
  manager: 'kwebhobit',
  category_order: 2,
  subcategory_order: 1,
  detailcategory_order: 1,
};

const data = { faqs: fixture, seniorFaqs: [...seniorFixture, seniorFour] };

// ───────── 엑셀 도우미 ─────────

const toBuf = async (wb: ExcelJS.Workbook) => Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);
const load = async (buf: Buffer) => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as any);
  return wb;
};
async function rewrite(buf: Buffer, edit: (wb: ExcelJS.Workbook) => void): Promise<Buffer> {
  const wb = await load(buf);
  edit(wb);
  return toBuf(wb);
}
const headers = (ws: ExcelJS.Worksheet) => (ws.getRow(1).values as any[]).slice(1).map((v) => cellText(v));
/** 칸 제목 → 칸 번호 */
const col = (ws: ExcelJS.Worksheet, header: string) => {
  const i = headers(ws).indexOf(header);
  if (i < 0) throw new Error(`no column ${header}`);
  return i + 1;
};
const findRow = (ws: ExcelJS.Worksheet, id: number) => {
  for (let r = 2; r <= ws.rowCount; r++) if (Number(ws.getRow(r).getCell(1).value) === id) return r;
  throw new Error(`no row ${id}`);
};
/** 칸 제목으로 새 줄 적기 */
const writeRow = (ws: ExcelJS.Worksheet, r: number, values: Record<string, string>) => {
  for (const [h, v] of Object.entries(values)) ws.getRow(r).getCell(col(ws, h)).value = v;
};
const idsOf = (ws: ExcelJS.Worksheet) => {
  const out: number[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const v = ws.getRow(r).getCell(1).value;
    if (v) out.push(Number(v));
  }
  return out;
};

// 예전 모양(답변 카드 하나가 한 줄) 파일 만들기 — 예전 코드가 만들던 것과 같은 칸·줄
function addLegacyFaqSheet(wb: ExcelJS.Workbook, rows: DbFaqRow[], name = SHEET_NAME) {
  const ws = wb.addWorksheet(name);
  ws.addRow(LEGACY_COLUMNS.map((c) => c.header));
  for (const r of rows) {
    const v = dbRowToView(r);
    v.cards.forEach((c, i) => {
      const head = i === 0 ? [r.id, AUDIENCE_LABEL[v.audience], v.maincategory_ko, v.maincategory_en, v.subcategory_ko, v.subcategory_en, v.question_ko, v.question_en] : Array(8).fill('');
      ws.addRow([...head, c.answer, c.answer_en, c.url, c.email, c.phone, i === 0 ? v.manager : '', '']);
    });
  }
  return ws;
}
function addLegacySeniorSheet(wb: ExcelJS.Workbook, rows: SeniorDbRow[]) {
  const ws = wb.addWorksheet('선배 FAQ');
  ws.addRow(LEGACY_SENIOR_COLUMNS.map((c) => c.header));
  for (const r of rows) {
    const v = seniorRowToView(r);
    v.cards.forEach((c, i) => {
      const head = i === 0 ? [r.id, v.maincategory_ko, v.maincategory_en, v.subcategory_ko, v.subcategory_en, v.detailcategory_ko, v.detailcategory_en] : Array(7).fill('');
      ws.addRow([...head, c.title, c.title_en, c.answer, c.answer_en, c.url, c.latitude, c.longitude, i === 0 ? v.manager : '', '']);
    });
  }
  return ws;
}

describe('hoBIT 데이터 엑셀 (FAQ 하나가 한 줄)', () => {
  it('만든 엑셀을 그대로 읽으면 바뀐 게 없어요 · 시트 모양', async () => {
    const buf = await buildHobitXlsx(data);
    const wb = await load(buf);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['사용 방법', ...FAQ_SHEETS.map((s) => s.name), '선배 FAQ', MANAGER_SHEET, EMAIL_SHEET]);
    expect([idsOf(wb.getWorksheet('학부 FAQ')!), idsOf(wb.getWorksheet('대학원 FAQ')!), idsOf(wb.getWorksheet('공통 FAQ')!)]).toEqual([[13, 10, 14], [11], [12]]);

    // 행정실 FAQ: 답변 묶음 7개, 4~7번째는 접힘, 번호~질문 고정
    const under = wb.getWorksheet('학부 FAQ')!;
    const h = headers(under);
    expect(h.slice(0, 13)).toEqual(['번호', '대상', '대분류', '대분류(영어)', '소분류', '소분류(영어)', '질문', '질문(영어)', '답변1', '답변1(영어)', '링크1', '이메일1', '전화1']);
    expect(h.slice(-7)).toEqual(['답변7', '답변7(영어)', '링크7', '이메일7', '전화7', '담당자', '삭제']);
    expect(h).toHaveLength(8 + 7 * 5 + 2);
    expect(under.getColumn(col(under, '전화3')).hidden).toBe(false);
    expect(under.getColumn(col(under, '답변4')).hidden).toBe(true);
    expect(under.getColumn(col(under, '답변4')).outlineLevel).toBe(1);
    expect(under.getColumn(col(under, '전화7')).hidden).toBe(true);
    expect(under.getColumn(col(under, '담당자')).hidden).toBe(false);
    expect(under.views[0]).toMatchObject({ state: 'frozen', xSplit: 7, ySplit: 1 });
    // 묶음마다 칸 제목 색이 번갈아
    const fill = (header: string) => (under.getRow(1).getCell(col(under, header)).fill as any)?.fgColor?.argb;
    expect(fill('답변1')).not.toBe(fill('답변2'));
    expect(fill('답변1')).toBe(fill('답변3'));
    // 회색 줄·입력 막기는 이제 없음, 대상·삭제 드롭다운은 그대로
    for (let r = 2; r <= under.rowCount; r++) {
      under.getRow(r).eachCell({ includeEmpty: true }, (c) => expect(c.dataValidation?.type ?? 'list').toBe('list'));
    }
    expect(under.getRow(2).getCell(col(under, '대상')).dataValidation?.type).toBe('list');
    expect(under.getRow(2).getCell(col(under, '삭제')).dataValidation?.type).toBe('list');
    // 전화번호 맨 앞 0이 그대로
    const grad = wb.getWorksheet('대학원 FAQ')!;
    expect(grad.getRow(2).getCell(col(grad, '전화1')).value).toBe('0232904000');

    // 선배 FAQ: 묶음 4개(가장 많은 답변 수), 4번째만 접힘, 번호~세부 항목 고정
    const ss = wb.getWorksheet('선배 FAQ')!;
    const sh = headers(ss);
    expect(sh.slice(0, 14)).toEqual(['번호', '대분류', '대분류(영어)', '소분류', '소분류(영어)', '세부 항목', '세부 항목(영어)', '제목1', '제목1(영어)', '답변1', '답변1(영어)', '링크1', '위도1', '경도1']);
    expect(sh).toHaveLength(7 + 4 * 7 + 2);
    expect(ss.getColumn(col(ss, '경도3')).hidden).toBe(false);
    expect(ss.getColumn(col(ss, '제목4')).hidden).toBe(true);
    expect(ss.views[0]).toMatchObject({ state: 'frozen', xSplit: 6, ySplit: 1 });

    // 링크 칸을 하이퍼링크로, 질문 칸에 전각 공백·보이지 않는 글자·여러 칸 띄움이 섞여도 같은 값
    const withLink = await rewrite(buf, (w) => {
      const ws = w.getWorksheet('학부 FAQ')!;
      const r = findRow(ws, 10);
      ws.getRow(r).getCell(col(ws, '링크1')).value = { text: 'https://portal.korea.ac.kr', hyperlink: 'https://portal.korea.ac.kr' };
      ws.getRow(r).getCell(col(ws, '질문')).value = { richText: [{ text: '휴학은　어떻게  ' }, { text: '해?​' }] };
    });
    const parsed = await parseHobitXlsx(withLink);
    const plan = buildHobitPlan(parsed, data);
    console.log('왕복:', JSON.stringify({ problems: plan.problems, warnings: plan.warnings }));

    const byId = new Map(parsed.faq!.faqs.map((f) => [f.id, f]));
    expect(byId.get(10)!.view.cards).toHaveLength(2);
    expect(byId.get(10)!.view.cards[0].answer).toBe('포털에서 신청해요.\n기간을 꼭 확인하세요.');
    expect(byId.get(10)!.view.manager).toBe('김호빗 🐰');
    expect(byId.get(11)!.view.audience).toBe('graduate');
    expect(byId.get(11)!.view.cards[0].phone).toBe('0232904000');
    expect(byId.get(12)!.view.cards).toHaveLength(3);
    expect(plan.problems).toEqual([]);
    expect(plan.missingSheets).toEqual([]);
    expect(plan.faq!.created).toEqual([]);
    expect(plan.faq!.deleted).toEqual([]);
    // 11번은 DB에 대상이 없어 규칙으로 '대학원'이 됨 → 엑셀도 대학원이라 바뀐 것 없음
    expect(plan.faq!.updated).toEqual([]);
    expect(plan.faq!.unchanged).toBe(5);
    expect(plan.faq!.missingFromFile).toEqual([]);
    expect(plan.senior!.updated).toEqual([]);
    expect(plan.senior!.unchanged).toBe(3);
    expect(parsed.senior!.items.find((i) => i.id === 4)!.view.cards).toHaveLength(4);
    expect(plan.managers).toEqual([]);
    expect(plan.emails).toEqual([]);
  });

  it('답변 고치기 · 답변 두 개짜리 새 FAQ · 답변 묶음 비우기 · 삭제 · 빠진 줄', async () => {
    const buf = await buildHobitXlsx(data);
    const edited = await rewrite(buf, (wb) => {
      const under = wb.getWorksheet('학부 FAQ')!;
      // 10번: 두 번째 답변 고치고 영어는 비움 → 자동 번역 대상
      const r10 = findRow(under, 10);
      under.getRow(r10).getCell(col(under, '답변2')).value = '군휴학은 병무청 서류가 필요해요.';
      under.getRow(r10).getCell(col(under, '답변2(영어)')).value = null;
      // 13번: 삭제
      under.getRow(findRow(under, 13)).getCell(col(under, '삭제')).value = '삭제';
      // 14번: 줄을 통째로 지움 → 그대로 둠
      under.spliceRows(findRow(under, 14), 1);

      // 12번 (답변 3개): 두 번째 답변 묶음을 모두 비움 → 답변 하나 지움
      const common = wb.getWorksheet('공통 FAQ')!;
      const r12 = findRow(common, 12);
      for (const h of ['답변2', '답변2(영어)', '링크2', '이메일2', '전화2']) common.getRow(r12).getCell(col(common, h)).value = null;
      // 공통 시트에 새 FAQ (답변 2개, 대상 칸 비움, 기존 소분류와 띄어쓰기만 다른 이름)
      writeRow(common, common.actualRowCount + 1, {
        대분류: '학적',
        소분류: '휴학 / 복학',
        질문: '복학 신청은 언제 해?',
        답변1: '학기 시작 전에 해요.',
        링크1: 'https://example.com/return',
        답변2: '방학 중에만 받아요.',
        '답변2(영어)': 'Only during vacation.',
        담당자: '김호빗',
      });
    });

    const plan = buildHobitPlan(await parseHobitXlsx(edited), data, { autoTranslate: true });
    const f = plan.faq!;
    console.log(
      '수정:',
      JSON.stringify(
        {
          created: f.created.map((c) => ({ row: c.row, sheet: c.sheet, q: c.view.question_ko, cards: c.view.cards })),
          updated: f.updated.map((u) => ({ id: u.id, sheet: u.sheet, row: u.row, changes: u.changes.map((c) => c.label) })),
          deleted: f.deleted.map((d) => [d.id, d.sheet, d.row]),
          unchanged: f.unchanged,
          missing: f.missingFromFile,
          problems: plan.problems,
          warnings: plan.warnings,
        },
        null,
        1
      )
    );

    expect(plan.problems).toEqual([]);
    expect(f.updated.map((u) => u.id)).toEqual([10, 12]);
    const u10 = f.updated[0];
    expect(u10.sheet).toBe('학부 FAQ');
    expect(u10.changes.map((c) => c.label)).toEqual(['답변 2', '답변(영어) 2']);
    expect(u10.changes[1].auto_translate).toBe(true);
    const u12 = f.updated[1];
    expect(u12.after.cards.map((c) => c.answer)).toEqual(['네, 증빙을 내면 돼요.', '기간은 학기마다 달라요.']);
    expect(f.created).toHaveLength(1);
    expect(f.created[0].sheet).toBe('공통 FAQ');
    expect(f.created[0].row).toBe(3);
    expect(f.created[0].view.audience).toBe('all');
    expect(f.created[0].view.maincategory_en).toBe('Academic Records'); // 기존 대분류 영어 이름으로 채움
    expect(f.created[0].view.cards).toEqual([
      { answer: '학기 시작 전에 해요.', answer_en: '', url: 'https://example.com/return', email: '', phone: '' },
      { answer: '방학 중에만 받아요.', answer_en: 'Only during vacation.', url: '', email: '', phone: '' },
    ]);
    expect(f.deleted.map((d) => [d.id, d.sheet])).toEqual([[13, '학부 FAQ']]);
    expect(f.missingFromFile).toEqual([14]);
    expect(f.unchanged).toBe(1);
    expect(plan.warnings.some((w) => w.message.includes("기존 '휴학/복학' 과 비슷해요"))).toBe(true);
    expect(plan.warnings.some((w) => w.sheet === '공통 FAQ' && w.row === 3 && w.message.includes('대상이 비어 있어서'))).toBe(true);

    // 새 소분류는 그 대분류의 맨 뒤
    const order = makeOrderAssigner(fixture);
    expect(order('학적', '휴학 / 복학')).toEqual({ category_order: 2, subcategory_order: 2 });
    expect(order('새 대분류', '새 소분류')).toEqual({ category_order: 10, subcategory_order: 1 });
  });

  it('정렬해도 답변이 다른 FAQ에 붙지 않아요', async () => {
    const buf = await buildHobitXlsx(data);
    const sorted = await rewrite(buf, (wb) => {
      for (const name of ['학부 FAQ', '선배 FAQ']) {
        const ws = wb.getWorksheet(name)!;
        const main = col(ws, '대분류');
        const n = ws.actualRowCount;
        const rows: any[][] = [];
        for (let r = 2; r <= n; r++) rows.push((ws.getRow(r).values as any[]).slice(1));
        // 대분류 내림차순 (엑셀 [정렬]과 같은 결과)
        rows.sort((a, b) => String(b[main - 1] ?? '').localeCompare(String(a[main - 1] ?? ''), 'ko'));
        rows.forEach((vals, i) => {
          const row = ws.getRow(i + 2);
          for (let c = 1; c <= vals.length; c++) row.getCell(c).value = vals[c - 1] ?? null;
        });
      }
    });
    const wb = await load(sorted);
    expect(idsOf(wb.getWorksheet('학부 FAQ')!)).toEqual([10, 14, 13]); // 학적 > 장학 > 수업 (순서가 실제로 바뀜)
    const plan = buildHobitPlan(await parseHobitXlsx(sorted), data);
    expect(plan.problems).toEqual([]);
    expect(plan.faq!.created).toEqual([]);
    expect(plan.faq!.updated).toEqual([]);
    expect(plan.faq!.deleted).toEqual([]);
    expect(plan.faq!.unchanged).toBe(5);
    expect(plan.senior!.updated).toEqual([]);
    expect(plan.senior!.unchanged).toBe(3);
  });

  it('막아야 하는 문제 — 시트·줄 번호로 안내', async () => {
    const buf = await buildHobitXlsx(data);
    const edited = await rewrite(buf, (wb) => {
      const grad = wb.getWorksheet('대학원 FAQ')!;
      grad.getRow(findRow(grad, 11)).getCell(col(grad, '대상')).value = '학생'; // 모르는 대상 (2번째 줄)
      const common = wb.getWorksheet('공통 FAQ')!;
      common.getRow(findRow(common, 12)).getCell(1).value = 999; // 없는 번호 (공통 2번째 줄)
      const base = { 대상: '학부', 대분류: '학적', 소분류: '휴학/복학' };
      writeRow(grad, 3, { ...base, 번호: '10', 질문: '다른 질문', 답변1: '답' }); // 번호 10이 두 번
      writeRow(grad, 4, { ...base, 질문: '대학원 행정실은 어디야?', 답변1: '답' }); // 같은 질문
      writeRow(grad, 5, { 대상: '학부', 질문: 'x'.repeat(301) }); // 빈 칸·너무 긴 질문
      writeRow(grad, 6, { 답변1: '질문 없이 답변만' }); // 예전처럼 아래 줄에 답변만
      writeRow(grad, 7, { ...base, 질문: '두 번째 답변이 링크만 있어요', 답변1: '답', 링크2: 'https://x.kr' }); // 답변2 비고 링크2만
    });
    const plan = buildHobitPlan(await parseHobitXlsx(edited), data);
    console.log('문제:', JSON.stringify(plan.problems, null, 1));
    const at = (sheet: string, row: number) => plan.problems.filter((p) => p.sheet === sheet && p.row === row).map((p) => p.message).join('\n');
    expect(at('대학원 FAQ', 2)).toContain("(지금: '학생')");
    expect(at('공통 FAQ', 2)).toContain('번호 999인 FAQ가 없어요');
    expect(at('대학원 FAQ', 3)).toContain('같은 번호(10)가 학부 FAQ 3번째 줄에도 있어요');
    expect(at('대학원 FAQ', 4)).toContain('질문과 똑같아요');
    expect(at('대학원 FAQ', 5)).toContain('대분류가 비어 있어요');
    expect(at('대학원 FAQ', 5)).toContain('답변이 비어 있어요');
    expect(at('대학원 FAQ', 5)).toContain('너무 길어요');
    expect(at('대학원 FAQ', 6)).toContain('같은 줄의 답변2 칸에 적어 주세요');
    expect(at('대학원 FAQ', 7)).toContain('답변2 칸이 비어 있어요');
  });

  it('FAQ 답변이 7개보다 많으면 묶음을 늘려서 빠뜨리지 않아요', async () => {
    const many: DbFaqRow = {
      ...fixture[0],
      id: 20,
      question_ko: '답변이 많은 질문',
      question_en: 'Many answers',
      answer_ko: JSON.stringify([...Array(9)].map((_, i) => card(`답 ${i + 1}`))),
      answer_en: JSON.stringify([...Array(9)].map((_, i) => card(`A ${i + 1}`))),
    };
    const d = { faqs: [...fixture, many], seniorFaqs: [] as SeniorDbRow[] };
    const buf = await buildHobitXlsx(d);
    const wb = await load(buf);
    for (const s of FAQ_SHEETS) expect(headers(wb.getWorksheet(s.name)!)).toContain('전화9'); // 세 시트 모두 같은 칸
    const plan = buildHobitPlan(await parseHobitXlsx(buf), d);
    expect(plan.problems).toEqual([]);
    expect(plan.faq!.unchanged).toBe(6);
  });

  it('선배 FAQ — 답변 고치기 · 답변 두 개짜리 새 항목 · 담당자 · 이메일 바꾸기', async () => {
    const buf = await buildHobitXlsx(data);
    const edited = await rewrite(buf, (wb) => {
      const ss = wb.getWorksheet('선배 FAQ')!;
      const r3 = findRow(ss, 3);
      ss.getRow(r3).getCell(col(ss, '답변2')).value = '정정은 수강신청 사이트에서 해.'; // 3번 두 번째 답변
      ss.getRow(r3).getCell(col(ss, '답변2(영어)')).value = null; // 영어는 비움 → 자동 번역
      // 4번: 네 번째(접힌) 묶음 비움 → 답변 하나 지움
      const r4 = findRow(ss, 4);
      for (const h of ['제목4', '제목4(영어)', '답변4', '답변4(영어)', '링크4', '위도4', '경도4']) ss.getRow(r4).getCell(col(ss, h)).value = null;
      writeRow(ss, ss.actualRowCount + 1, {
        대분류: '수강신청',
        소분류: '일반',
        '세부 항목': '팁',
        제목1: '팁',
        답변1: '친구랑 시간표 맞춰 봐.',
        답변2: '강의평도 꼭 봐.',
        '답변2(영어)': 'Check reviews.',
        담당자: '김호빗 🐰',
      });
      // 담당자: '김호빗 🐰' → '김호빗'
      const ms = wb.getWorksheet(MANAGER_SHEET)!;
      for (let r = 2; r <= ms.rowCount; r++) if (ms.getRow(r).getCell(1).value === '김호빗 🐰') ms.getRow(r).getCell(4).value = '김호빗';
      // 이메일: info@korea.ac.kr → office@korea.ac.kr
      const es = wb.getWorksheet(EMAIL_SHEET)!;
      for (let r = 2; r <= es.rowCount; r++) if (es.getRow(r).getCell(1).value === 'info@korea.ac.kr') es.getRow(r).getCell(3).value = 'office@korea.ac.kr';
    });
    const plan = buildHobitPlan(await parseHobitXlsx(edited), data, { autoTranslate: true });
    console.log(
      '선배 FAQ:',
      JSON.stringify(
        {
          created: plan.senior!.created.map((c) => c.view),
          updated: plan.senior!.updated.map((u) => ({ id: u.id, changes: u.changes.map((c) => c.label) })),
          managers: plan.managers,
          emails: plan.emails,
          problems: plan.problems,
        },
        null,
        1
      )
    );
    expect(plan.problems).toEqual([]);
    expect(plan.faq!.unchanged).toBe(5);
    expect(plan.senior!.updated.map((u) => u.id)).toEqual([3, 4]);
    expect(plan.senior!.updated[0].changes.map((c) => c.label)).toEqual(['답변 2', '답변(영어) 2']);
    expect(plan.senior!.updated[0].changes[1].auto_translate).toBe(true);
    expect(plan.senior!.updated[1].after.cards).toHaveLength(3);
    expect(plan.senior!.created).toHaveLength(1);
    expect(plan.senior!.created[0].view.maincategory_en).toBe('Course Registration');
    expect(plan.senior!.created[0].view.cards.map((c) => c.answer)).toEqual(['친구랑 시간표 맞춰 봐.', '강의평도 꼭 봐.']);
    expect(plan.managers).toEqual([{ row: expect.any(Number), from: '김호빗 🐰', to: '김호빗', raw: ['김호빗 🐰'], faq_count: 1, senior_count: 1 }]);
    expect(plan.emails).toEqual([{ row: expect.any(Number), from: 'info@korea.ac.kr', to: 'office@korea.ac.kr', count: 1 }]);
    expect(makeSeniorOrderAssigner(seniorFixture)('수강신청', '일반', '팁')).toEqual({ category_order: 1, subcategory_order: 1, detailcategory_order: 3 });

    // 막아야 하는 것: 같은 이메일을 두 값으로, 이어지는 이름 바꾸기
    const bad = await rewrite(buf, (wb) => {
      const es = wb.getWorksheet(EMAIL_SHEET)!;
      const n = es.actualRowCount;
      es.getRow(n + 1).values = ['info@korea.ac.kr', '', 'a@korea.ac.kr'];
      es.getRow(n + 2).values = ['info@korea.ac.kr', '', 'b@korea.ac.kr'];
      const ms = wb.getWorksheet(MANAGER_SHEET)!;
      for (let r = 2; r <= ms.rowCount; r++) {
        if (ms.getRow(r).getCell(1).value === '김호빗 🐰') ms.getRow(r).getCell(4).value = '이담당';
        if (ms.getRow(r).getCell(1).value === '이담당') ms.getRow(r).getCell(4).value = '박담당';
      }
    });
    const msgs = buildHobitPlan(await parseHobitXlsx(bad), data).problems.map((p) => `${p.sheet}: ${p.message}`).join('\n');
    expect(msgs).toContain("이메일: 'info@korea.ac.kr'이(가)");
    expect(msgs).toContain("담당자: 바꿀 값 '이담당'도 다른 줄에서 바뀌어요");
  });

  it("다른 시트로 옮기면 대상이 바뀌어요", async () => {
    const wb = await load(await buildHobitXlsx(data));
    const under = wb.getWorksheet('학부 FAQ')!;
    const r10 = findRow(under, 10);
    const vals = (under.getRow(r10).values as any[]).slice(1);
    under.spliceRows(r10, 1);
    const common = wb.getWorksheet('공통 FAQ')!;
    const row = common.getRow(common.actualRowCount + 1);
    row.values = vals;
    row.getCell(col(common, '대상')).value = null; // 대상 칸을 비우면 시트 기준 '공통'
    const plan = buildHobitPlan(await parseHobitXlsx(await toBuf(wb)), data);
    expect(plan.problems).toEqual([]);
    expect(plan.faq!.updated.map((u) => [u.id, u.sheet, u.row, u.changes.map((c) => c.label)])).toEqual([[10, '공통 FAQ', 3, ['대상']]]);
    expect(plan.faq!.updated[0].after.audience).toBe('all');
  });

  it('예전 모양(답변 카드 하나가 한 줄) 파일도 똑같이 읽어요', async () => {
    // 'FAQ' 시트 하나뿐인 예전 파일
    const single = new ExcelJS.Workbook();
    addLegacyFaqSheet(single, fixture);
    const singleBuf = await toBuf(single);
    const p1 = buildHobitPlan(await parseHobitXlsx(singleBuf), data);
    expect(p1.problems).toEqual([]);
    expect(p1.missingSheets).toEqual(['선배 FAQ', MANAGER_SHEET, EMAIL_SHEET]);
    expect(p1.senior).toBeNull();
    expect(p1.faq!.unchanged).toBe(5);
    expect(p1.faq!.updated).toEqual([]);

    // 오늘 받은 세 시트 + 예전 선배 FAQ 시트
    const three = new ExcelJS.Workbook();
    for (const s of FAQ_SHEETS) addLegacyFaqSheet(three, fixture.filter((f) => dbRowToView(f).audience === s.audience), s.name);
    addLegacySeniorSheet(three, data.seniorFaqs);
    const threeBuf = await toBuf(three);
    const p2 = buildHobitPlan(await parseHobitXlsx(threeBuf), data);
    expect(p2.problems).toEqual([]);
    expect(p2.faq!.unchanged).toBe(5);
    expect(p2.faq!.updated).toEqual([]);
    expect(p2.senior!.unchanged).toBe(3);
    expect(p2.senior!.updated).toEqual([]);

    // 예전 모양에서 다음 답변 줄을 고쳐도 같은 바뀜으로 읽힘
    const edited = await rewrite(threeBuf, (wb) => {
      const ws = wb.getWorksheet('학부 FAQ')!;
      const r10 = findRow(ws, 10);
      ws.getRow(r10 + 1).getCell(col(ws, '답변')).value = '군휴학은 병무청 서류가 필요해요.';
      ws.getRow(r10 + 1).getCell(col(ws, '답변(영어)')).value = null;
    });
    const p3 = buildHobitPlan(await parseHobitXlsx(edited), data, { autoTranslate: true });
    expect(p3.problems).toEqual([]);
    expect(p3.faq!.updated.map((u) => [u.id, u.sheet, u.changes.map((c) => c.label)])).toEqual([[10, '학부 FAQ', ['답변 2', '답변(영어) 2']]]);

    // 시트 하나만 바로 읽기 (예전 'FAQ' 시트)
    const direct = parseFaqSheet((await load(singleBuf)).getWorksheet(SHEET_NAME))!;
    expect(buildImportPlan(direct, fixture).unchanged).toBe(5);
  });

  it('칸 값 종류', () => {
    expect(cellText(232904000)).toBe('232904000');
    expect(cellText({ formula: 'A1', result: 'x' } as any)).toBe('x');
    expect(cellText({ text: '', hyperlink: 'mailto:a@b.c' } as any)).toBe('a@b.c');
    expect(cellText({ text: { richText: [{ text: 'a' }, { text: 'b' }] }, hyperlink: 'http://x' } as any)).toBe('ab');
    expect(cellText({ error: '#N/A' } as any)).toBe('');
  });

  it('이메일 칸 안의 이메일만 바꿔요', () => {
    expect(replaceEmailInField('a@x.kr, info@korea.ac.kr', 'info@korea.ac.kr', 'n@x.kr')).toBe('a@x.kr, n@x.kr');
    expect(replaceEmailInField('myinfo@korea.ac.kr', 'info@korea.ac.kr', 'n@x.kr')).toBe('myinfo@korea.ac.kr');
    expect(collectEmails({ faqs: fixture, seniorFaqs: [] })).toEqual([{ email: 'info@korea.ac.kr', count: 1 }]);
  });
});
