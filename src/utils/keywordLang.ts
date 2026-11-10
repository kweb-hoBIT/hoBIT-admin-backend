/**
 * 키워드 규칙의 한국어 / 영어 단어 나누기
 *   예전에는 영어 단어·약어(cs, comp sci)도 synonyms에 섞어 저장했음 → 지금은 synonyms_en에 따로
 *   예전 줄도 그대로 동작하도록, 읽을 때 synonyms 안의 영어 단어를 영어 쪽으로 옮겨 보여 줌
 * 호빗(hoBIT-backend/src/apis/keywordRules.ts)·관리자 화면(keywordMatch.ts)과 같은 기준
 */

/** 영어 단어·약어 (한글 없이 영문이 있는 말) */
export const isLatin = (w: string) => !/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(w) && /[a-z]/i.test(w);

/** synonyms(한국어 칸)에 섞인 영어 단어는 영어 칸 뒤에 붙임 (순서 유지, 같은 단어는 한 번만) */
export function splitKeywordLang(synonyms: string[], synonymsEn: string[]): { synonyms: string[]; synonyms_en: string[] } {
  return {
    synonyms: synonyms.filter((w) => !isLatin(w)),
    synonyms_en: Array.from(new Set([...synonymsEn, ...synonyms.filter(isLatin)])),
  };
}
