import express, { Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import Request from "../../../types/Request";
import auth from "../../../middleware/auth";
import env from '../../../../config/env';
import { OpenAI } from "openai";
import { getUnmatchedQuestionRequest, getUnmatchedQuestionResponse } from "questionLog";

const router = express.Router();

const openai = new OpenAI({
  apiKey: env.OPENAI_KEY,
});

// @route   post api/questionlogs/unmatched
// @desc    Get all unmatched questions
// @access  Private
router.post('/unmatched', async (req: Request, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();
  const { user_questions } : getUnmatchedQuestionRequest['body'] = req.body;
  try {

    const question_ko: string[] = []
    const question_en: string[] = []

    await connection.execute<RowDataPacket[]>(
      `SELECT faqs.question_ko, faqs.question_en FROM hobit.faqs`
    ).then(([data]) => {
      data.map((question) => {
        question_ko.push(question.question_ko)
        question_en.push(question.question_en)
      })
    });

    const userQuestionKo: string[] = []
    const userQuestionEn: string[] = []

    user_questions.map((question) => {
      question.language === 'KO' ? userQuestionKo.push(question.user_question) : userQuestionEn.push(question.user_question)
    });

    const unmatched: string[] = [];


    if (userQuestionKo.length > 0) {
      const similarityResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "다음 두 개의 질문 목록에서 유사한 질문들을 매칭한 후, 기존 질문(question_ko)에 유사한 질문이 없는 userQuestionKo 항목만 반환하세요. JSON 형식으로 반환해주세요:",
          },
          {
            role: "user",
            content: JSON.stringify({ question_ko, userQuestionKo }),
          },
        ],
        temperature: 0.3,
      });

      const responseText = similarityResponse.choices[0].message.content;
      const parsedResponse = JSON.parse(responseText);
      unmatched.push(...(parsedResponse.unmatched || []));
    }



    if (userQuestionEn.length > 0) {
      const similarityResponseEn = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "다음 두 개의 질문 목록에서 유사한 질문들을 매칭한 후, 기존 질문(question_en)에 유사한 질문이 없는 userQuestionEn 항목만 한글로 번역해서 반환하세요. JSON 형식으로 반환해주세요:",
          },
          {
            role: "user",
            content: JSON.stringify({ question_en, userQuestionEn }),
          },
        ],
        temperature: 0.3,
      });

      const responseText = similarityResponseEn.choices[0].message.content;
      const parsedResponse = JSON.parse(responseText);
      unmatched.push(...(parsedResponse.unmatched || []));
    }


  console.log(unmatched);
    












    const response = 1
    res.status(200).json(response);
  } catch (err: any) {
    const response = {
      statusCode: 500,
      message: err.message,
    }
    console.log(response);
    res.status(500).json(response);
  } finally {
    connection.release();
  }
});


export default router;