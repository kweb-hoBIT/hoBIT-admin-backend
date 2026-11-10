// 키워드 규칙 저장 전 정리 — 한국어·영어 칸 나누기 (DB 없이)
//   npx jest tests/api/keywords/keywordClean.test.ts
import { clean } from '../../../src/routes/api/keywords/keywordsIndex';
import { splitKeywordLang } from '../../../src/utils/keywordLang';

jest.mock('../../../config/connectDB', () => ({ Pool: { query: jest.fn() } }));

describe('키워드 규칙 저장 (한국어 / 영어)', () => {
  it('영어 대표 키워드·영어 단어를 따로 저장', () => {
    const { rule, error } = clean({
      keyword: ' 컴퓨터학과 ',
      synonyms: ['컴학', '컴과', '컴학'],
      keyword_en: ' computer science ',
      synonyms_en: ['cs', 'comp sci', 'Computer Science', ''],
    });
    expect(error).toBeUndefined();
    expect(rule).toMatchObject({
      keyword: '컴퓨터학과',
      keyword_en: 'computer science',
      synonyms: ['컴학', '컴과'],
      synonyms_en: ['cs', 'comp sci'], // 영어 대표 키워드와 같은 단어는 빠짐
    });
  });

  it('예전 모양(synonyms에 영어 섞임)으로 보내도 영어 칸으로 옮김, 영어 대표 키워드는 없어도 됨', () => {
    const { rule } = clean({ keyword: '컴퓨터학과', synonyms: ['컴학', 'CS', 'comp sci'] });
    expect(rule).toMatchObject({ keyword_en: null, synonyms: ['컴학'], synonyms_en: ['CS', 'comp sci'] });
  });

  it('너무 긴 영어 대표 키워드·너무 많은 영어 단어는 막음', () => {
    expect(clean({ keyword: '가', keyword_en: 'x'.repeat(101) }).error).toContain('영어 대표 키워드');
    expect(clean({ keyword: '가', synonyms_en: Array.from({ length: 51 }, (_, i) => `w${i}`) }).error).toContain('영어 단어');
  });

  it('splitKeywordLang — 한국어 칸의 영어 단어는 영어 칸 뒤로, 같은 단어는 한 번만', () => {
    expect(splitKeywordLang(['컴학', 'cs', 'CS 졸업'], ['cs'])).toEqual({ synonyms: ['컴학', 'CS 졸업'], synonyms_en: ['cs'] });
  });
});
