import express, { Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import Request from "../../../types/Request";
import auth from "../../../middleware/auth";
import env from '../../../../config/env';
import { OpenAI } from "openai";
import { getUnmatchedQuestionResponse } from "questionLog";

export type userQuestion = {
  user_question: string;
  language: string;
}

const router = express.Router();

const openai = new OpenAI({
  apiKey: env.OPENAI_KEY,
});

// @route   post api/questionlogs/unmatched
// @desc    Get all unmatched questions
// @access  Private
router.post('/unmatched', async (req: Request, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();

  try {
    const userQuestionRow = await connection.execute<RowDataPacket[]>(
      `SELECT user_question FROM hobit.question_logs WHERE ismatched = 0`
    ).then(([rows]) => {
      return rows.map(row => row.user_question);
    });
    
    let userQuestion = userQuestionRow as userQuestion[];

    if (userQuestion.length > 0) {
      const similarityCheckResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
            당신은 대학 챗봇을 위한 유사한 질문을 필터링하는 도우미입니다.
    
            📌 **목표:** 
            - 첫번쨰로 userQuestion에는 한글 질문과 영어 질문이 있을 수 있을 수 있어 영어 질문인 경우에는 한글로 번역해주세요.
            - 두번쨰로 주어진 리스트에서 의미가 비슷한 질문을 찾아 하나만 남기고 나머지는 제거하세요.
            - 질문들이 매우 유사한 경우, 하나만 남기고 나머지는 중복으로 간주하여 제외해야 합니다.
          
            📌 **응답 형식 (JSON):**
            아래의 리스트 중에서 의미가 비슷한 질문을 하나만 남기고 나머지는 제외한 질문 리스트만 반환하세요(반환된 리스트에 있는 값들은 모두 한글이여야 합니다).
            
            {
              "unique_questions": ["질문1", "질문2", ...]
            }
            `,
          },
          {
            role: "user",
            content: JSON.stringify({ userQuestion }),
          },
        ],
        temperature: 0.3,
      });
    
      const responseText = similarityCheckResponse.choices[0].message.content?.trim();
      const parsedResponse = JSON.parse(responseText);
    
      userQuestion = parsedResponse.unique_questions || [];
    }

    const question = await connection.execute<RowDataPacket[]>(
      `SELECT faqs.question_ko FROM hobit.faqs`
    ).then (([rows]) => {
      return rows.map(row => row.question_ko);
    });

    const unmatched: string[] = [];

    if (userQuestion.length > 0) {
      const similarityResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
            당신은 대학생들이 자주 하는 질문을 분석하고, 기존 FAQ(question_ko)와 유사한 질문을 매칭하는 도우미입니다.
      
            📌 **목표:** 
            - 사용자의 질문 리스트(userQuestion)에서 기존 FAQ(question)와 의미적으로 동일하거나 매우 유사한 질문을 찾습니다.
            - 기존 FAQ 리스트(question)에서 **유사한 질문이 하나라도 존재하면** 해당 userQuestion 항목은 "매칭된 것으로 간주"합니다.
            - **매칭된 질문은 제외하고**, 일치하는 질문이 전혀 없는 userQuestion 항목만 unmatched로 반환하세요.
      
            📌 **매칭 기준:**  
            ✅ 의미가 같거나 매우 유사한 질문은 같은 질문으로 간주  
            ✅ 동의어나 표현 차이를 고려 (예: "빌릴 수 있나요?" ↔ "대여하고 싶어요", "여는 시간" ↔ "오픈 시간")  
            ✅ 문장 구조가 달라도 의미가 같으면 같은 질문으로 처리  
            ✅ 띄어쓰기, 철자 차이, 존댓말/반말 차이 무시  
            ✅ 단, 완전히 다른 의미의 질문은 매칭되지 않도록 주의  
      
            📌 **응답 형식 (JSON):**  
            반환할 데이터는 unmatched 리스트만 포함해야 하며, Markdown 코드 블록(\`\`\`json ... \`\`\`)을 사용하지 마세요.
      
            {
              "unmatched": ["질문1", "질문2", ...]
            }
            `,
          },
          {
            role: "user",
            content: JSON.stringify({ question_ko: question, userQuestion }),
          },
        ],
        temperature: 0.3,
      });

      const responseText = similarityResponse.choices[0].message.content?.trim();
      const parsedResponse = JSON.parse(responseText);
      unmatched.push(...(parsedResponse.unmatched || []));
    }

    const data = unmatched.map((question) => {
      return [
        question,
        '질문과 무관한 답변',
        'AI가 해당 질문이 FAQ에 없음을 확인하여 추가 검토가 필요함',
        'KO'
      ] 
    });

    await connection.query(
      `INSERT INTO hobit.user_feedbacks (user_question, feedback_reason, feedback_detail, language) VALUES ?`,
      [data]
    );

    const response: getUnmatchedQuestionResponse = {
      statusCode: 200,
      message: "Unmatched questions returned successfully",
      unmatched: unmatched
    }
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