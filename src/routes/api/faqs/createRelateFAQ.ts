import express, { Response } from "express";
import { OpenAI } from "openai";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { RelatedFAQRequest, RelatedFAQResponse } from '../../../types/faq';
import env from '../../../../config/env';
import Request from "../../../types/Request";
import auth from "../../../middleware/auth";

const router = express.Router();

const openai = new OpenAI({
  apiKey: env.OPENAI_KEY,
});

router.post("/related", auth, async (req: Request, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();
  console.log(env.OPENAI_API_KEY)
  try {
    const { faq_id, question, count = 10 } : RelatedFAQRequest['body'] = req.body;
    const koreanCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
          당신은 대학교 챗봇을 위한 자연스러운 질문을 생성하는 도우미입니다.
          요청된 질문과 관련된 유사한 질문들을 생성할 때 다음 지침을 따르세요:
          
          - 20대 대학생들이 실제로 사용할 법한 구어체와 캐주얼한 말투를 사용하세요
          - '~있나요?', '~할까요?', '~해주세요' 같은 딱딱한 표현보다는 '~있어?', '~할래?', '~해줘' 같은 친근한 표현을 사용하세요
          - 대학생들이 자주 쓰는 줄임말이나 구어체를 자연스럽게 포함하세요
          - 문장의 시작과 끝에 “, ”, ‘, ’, ' 이와 같은 특수문자를 사용하지 말고 " " 이것만 사용하세요
          
          결과는 다음 JSON 형식으로 반환하고 따옴표는 "" 이것만 사용하세요:
          {
            "ko": ["질문1", "질문2", ...],
            "en": ["question1", "question2", ...]
          }
          `,
        },
        {
          role: "user",
          content: `다음 질문과 관련된 ${count}개의 유사한 질문을 생성하고 JSON 배열 형식으로 반환해주세요. 질문: "${question}"`,
        },
      ],
      temperature: 0.6,
    });

    let responseContent = koreanCompletion.choices[0].message.content;
    responseContent = responseContent.trim();
    responseContent = responseContent.replace(/[“”‘’]/g, '"');
    const relatedQuestions = JSON.parse(responseContent);
    const uninonRelatedQuestions = [...relatedQuestions.ko, ...relatedQuestions.en];
    console.log(uninonRelatedQuestions);

    const [row] = await connection.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM hobit.related_faqs WHERE faq_id = ?`,
      [faq_id]
    );

    const countRelated = row[0].count as number;

    if(countRelated > 0) {
      await connection.execute<RowDataPacket[]>(
        `Update hobit.related_faqs SET related_faqs = ? WHERE faq_id = ?`,
        [JSON.stringify(uninonRelatedQuestions), faq_id]
      );
    } else{
      await connection.execute<RowDataPacket[]>(
        `INSERT INTO hobit.related_faqs (faq_id, related_faqs) VALUES (?, ?)`,
        [faq_id, JSON.stringify(uninonRelatedQuestions)]
      );
    }
    
    const response : RelatedFAQResponse= {
      statusCode: 200,
      message: "Related questions generated successfully",
    }
    console.log(response);
    res.status(200).json(response);
  } catch (error) {
    const response = {
      statusCode: 500,
      error: error.message,
    }
    console.error(response);
    res.status(500).json(response);
  } finally {
    connection.release();
  }
});

export default router;
