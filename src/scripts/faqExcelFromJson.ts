/**
 * faqs JSON → FAQ 엑셀 (첫 양식 만들기용, DB·.env 필요 없음)
 *
 *   npm run build
 *   node dist/src/scripts/faqExcelFromJson.js <faqs.json> [out.xlsx]
 *
 * faqs.json: `SELECT * FROM faqs` 결과 배열 (answer_ko/answer_en은 JSON 글자 그대로)
 *   { "faqs": [...] } 이나 mysql 내보내기처럼 한 겹 감싼 모양도 받음
 *   audience 칸이 없으면 처음 규칙(대학원 → 대학원, 행정실·ETC 공통 업무 → 공통, 나머지 학부)으로 채움
 */
import fs from 'fs';
import path from 'path';
import { buildFaqXlsx, DbFaqRow } from '../utils/faqExcel';

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
    console.error('사용법: node dist/src/scripts/faqExcelFromJson.js <faqs.json> [out.xlsx]');
    process.exit(1);
  }
  const rows = pickRows(JSON.parse(fs.readFileSync(input, 'utf8'))).map((r: any) => ({
    ...r,
    id: Number(r.id ?? r.faq_id),
    category_order: r.category_order === undefined || r.category_order === null ? null : Number(r.category_order),
    subcategory_order: r.subcategory_order === undefined || r.subcategory_order === null ? null : Number(r.subcategory_order),
  }));
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
  const out = outArg ?? path.join(path.dirname(input), `hoBIT_FAQ_${today}.xlsx`);
  fs.writeFileSync(out, await buildFaqXlsx(rows));
  console.log(`FAQ ${rows.length}개 → ${out}`);
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
