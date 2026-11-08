import express, { Response } from "express";
import { TranslateFAQRequest, TranslateFAQResponse } from '../../../types/translate';
import Request from "../../../types/Request";
import auth from "../../../middleware/auth";
import env from '../../../../config/env';

const router = express.Router();

// 공식 영문 이름 고정 — DeepL이 "정보대학"을 College of Information Science 등으로 옮기던 문제.
// 번역 전에 한국어 이름을 영문 이름으로 바꿔 두고(영어는 그대로 둠), 번역 뒤에도 흔한 오역을 고침.
// 긴 이름부터 (고려대학교 정보대학 → 정보대학 순)
const GLOSSARY: [string, string][] = [
  ['고려대학교 정보대학', 'Korea University College of Informatics'],
  ['고려대 정보대학', 'Korea University College of Informatics'],
  ['정보대학', 'College of Informatics'],
  ['고려대학교', 'Korea University'],
];
const MISTRANSLATIONS: [RegExp, string][] = [
  [/College of Information(?:\s+(?:Science|Sciences|Technology))?(?![a-z])/g, 'College of Informatics'],
  [/(?:School|Faculty|Department) of Informatics(?![a-z])/g, 'College of Informatics'],
];

export function applyGlossary(text: string): string {
  return GLOSSARY.reduce((acc, [ko, en]) => acc.split(ko).join(en), text);
}

export function fixTranslation(text: string): string {
  return MISTRANSLATIONS.reduce((acc, [re, en]) => acc.replace(re, en), text);
}

/**
 * 여러 글을 한 번에 영어로 (엑셀 올리기에서 비어 있는 영어 칸 채우기)
 *   DeepL에 한 번에 최대 40개씩 보냄. 실패하면 오류를 던짐 (부른 쪽에서 처리)
 */
export async function translateTexts(texts: string[]): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < texts.length; i += 40) {
    const chunk = texts.slice(i, i + 40);
    const body = new URLSearchParams();
    chunk.forEach((t) => body.append('text', applyGlossary(t)));
    body.append('target_lang', 'EN');
    const resp = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `DeepL-Auth-Key ${env.DEEPL_KEY}`,
      },
      body: body.toString(),
    });
    if (!resp.ok) throw new Error(`DeepL ${resp.status}`);
    const data: any = await resp.json();
    const translations: any[] = data?.translations ?? [];
    if (translations.length !== chunk.length) throw new Error('DeepL 응답 개수가 맞지 않음');
    translations.forEach((t) => out.push(fixTranslation(String(t.text ?? ''))));
  }
  return out;
}

// @route   POST api/translate/
// @desc    Translate the given text and return the translated result
// @access  Private
router.post("/", async (req: Request, res: Response) => {
  const { text }: TranslateFAQRequest['body'] = req.body;

  try {
    const translateResponse = await fetch(
      'https://api-free.deepl.com/v2/translate',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `DeepL-Auth-Key ${env.DEEPL_KEY}`, // ✅ 최신 방식
        },
        body: new URLSearchParams({
          text: applyGlossary(text),
          target_lang: 'EN',
        }).toString(),
      }
    );

    // console.log('🔥🔥🔥DEEPL status:', translateResponse.status);
    const raw = await translateResponse.text(); // ✅ 한 번만 읽기
    // console.log('🔥🔥🔥DEEPL raw response:', raw);

    if (!translateResponse.ok) {
      return res.status(translateResponse.status).json({
        statusCode: translateResponse.status,
        message: raw,
      });
    }

    const data = JSON.parse(raw);

    res.status(200).json({
      statusCode: 200,
      message: 'Text translated successfully',
      data: {
        translatedText: fixTranslation(data.translations[0].text),
      },
    });
  } catch (error: any) {
    res.status(500).json({
      statusCode: 500,
      message: error.message,
    });
  }
});

export default router;
