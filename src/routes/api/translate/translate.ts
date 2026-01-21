import express, { Response } from "express";
import { TranslateFAQRequest, TranslateFAQResponse } from '../../../types/translate';
import Request from "../../../types/Request";
import auth from "../../../middleware/auth";
import env from '../../../../config/env';

const router = express.Router();

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
          text,
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
        translatedText: data.translations[0].text,
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
