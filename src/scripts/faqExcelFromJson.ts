/**
 * JSON → hoBIT 데이터 엑셀 (사용 방법 · 학부/대학원/공통 FAQ · 선배 FAQ · 담당자 · 이메일 시트, FAQ 하나가 한 줄, 첫 양식 만들기용, DB·.env 필요 없음)
 *
 *   npm run build
 *   npm run faq:excel -- <data.json> [out.xlsx]
 *   (= node dist/src/scripts/faqExcelFromJson.js <data.json> [out.xlsx])
 *
 * data.json: { "faqs": [...], "senior_faqs": [...] } — 각각 `SELECT * FROM faqs` / `SELECT * FROM senior_faqs` 결과
 *   (answer_ko/answer_en은 JSON 글자 그대로). 배열 하나만 있으면 faqs로 봄 (선배 FAQ 시트는 빈 칸)
 *   audience 칸이 없으면 처음 규칙(대학원 → 대학원, 행정실·ETC 공통 업무 → 공통, 나머지 학부)으로 채움
 */
import fs from 'fs';
import path from 'path';
import { DbFaqRow } from '../utils/faqExcel';
import { buildHobitXlsx } from '../utils/hobitWorkbook';

function pickSenior(json: any): any[] {
  if (json && !Array.isArray(json)) return json.senior_faqs ?? json.seniorFaqs ?? json.data?.senior_faqs ?? [];
  return [];
}

function pickRows(json: any): DbFaqRow[] {
  if (Array.isArray(json)) {
    // phpMyAdmin JSON 내보내기: [{type:'header'}, {type:'table', data:[...]}]
    const table = json.find((x) => x && x.type === 'table' && Array.isArray(x.data));
    return table ? table.data : json;
  }
  if (json && Array.isArray(json.faqs)) return json.faqs;
  if (json && Array.isArray(json.data)) return json.data;
  if (json && json.data && Array.isArray(json.data.faqs)) return json.data.faqs;
  throw new Error('faqs 배열을 찾지 못했어요');
}

async function main() {
  const [input, outArg] = process.argv.slice(2);
  if (!input) {
    console.error('사용법: node dist/src/scripts/faqExcelFromJson.js <data.json> [out.xlsx]');
    process.exit(1);
  }
  const json = JSON.parse(fs.readFileSync(input, 'utf8'));
  const num = (v: unknown) => (v === undefined || v === null || v === '' ? null : Number(v));
  const rows = pickRows(json).map((r: any) => ({
    ...r,
    id: Number(r.id ?? r.faq_id),
    category_order: num(r.category_order),
    subcategory_order: num(r.subcategory_order),
  }));
  const seniors = pickSenior(json).map((r: any) => ({
    ...r,
    id: Number(r.id ?? r.senior_faq_id),
    category_order: num(r.category_order),
    subcategory_order: num(r.subcategory_order),
    detailcategory_order: num(r.detailcategory_order),
  }));
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
  const out = outArg ?? path.join(path.dirname(input), `hoBIT_데이터_${today}.xlsx`);
  fs.writeFileSync(out, await buildHobitXlsx({ faqs: rows, seniorFaqs: seniors }));
  console.log(`FAQ ${rows.length}개, 선배 FAQ ${seniors.length}개 → ${out}`);
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
