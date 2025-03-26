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

    let unmatched: string[] = [];

    if (userQuestionKo.length > 0) {
      const similarityResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
            당신은 대학생들이 자주 하는 질문을 분석하고, 기존 FAQ(question_ko)와 유사한 질문을 매칭하는 도우미입니다.
      
            📌 **목표:** 
            - 사용자의 질문 리스트(userQuestionKo)에서 기존 FAQ(question_ko)와 의미적으로 동일하거나 매우 유사한 질문을 찾습니다.
            - 기존 FAQ 리스트(question_ko)에서 **유사한 질문이 하나라도 존재하면** 해당 userQuestionKo 항목은 "매칭된 것으로 간주"합니다.
            - **매칭된 질문은 제외하고**, 일치하는 질문이 전혀 없는 userQuestionKo 항목만 unmatched로 반환하세요.
      
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
            content: JSON.stringify({ question_ko, userQuestionKo }),
          },
        ],
        temperature: 0.3,
      });

      const responseText = similarityResponse.choices[0].message.content?.trim();
      const parsedResponse = JSON.parse(responseText);
      unmatched.push(...(parsedResponse.unmatched || []));
    }


    if (userQuestionEn.length > 0) {
      const similarityResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
            당신은 대학생들이 자주 하는 질문을 분석하고, 기존 FAQ(question_en)와 유사한 질문을 매칭하는 도우미입니다.
            
            📌 **목표:**  
            - 사용자의 질문 리스트(userQuestionEn)에서 기존 FAQ(question_en)와 의미적으로 동일하거나 매우 유사한 질문을 찾습니다.
            - 기존 FAQ 리스트(question_en)에서 **유사한 질문이 하나라도 존재하면** 해당 userQuestionEn 항목은 "매칭된 것으로 간주"합니다.
            - **매칭된 질문은 제외하고**, 일치하는 질문이 전혀 없는 userQuestionEn 항목만 unmatched로 반환하세요.
            - unmatched 질문들은 **한국어로 번역하여 반환하세요**.
    
            📌 **매칭 기준:**  
            ✅ 의미가 같거나 매우 유사한 질문은 같은 질문으로 간주  
            ✅ 동의어나 표현 차이를 고려 (예: "Can I borrow?" ↔ "I want to rent", "What time do you open?" ↔ "When do you open?")  
            ✅ 문장 구조가 달라도 의미가 같으면 같은 질문으로 처리  
            ✅ 띄어쓰기, 철자 차이, 존댓말/반말 차이 무시  
            ✅ 단, 완전히 다른 의미의 질문은 매칭되지 않도록 주의  
    
            📌 **응답 형식 (JSON):**  
            반환할 데이터는 unmatched 리스트만 포함해야 하며, **모든 unmatched 질문은 한국어로 번역하여 반환**하세요.  
            Markdown 코드 블록(\`\`\`json ... \`\`\`)을 사용하지 마세요.
    
            {
              "unmatched": ["질문1", "질문2", ...]
            }
            `,
          },
          {
            role: "user",
            content: JSON.stringify({ question_en, userQuestionEn }),
          },
        ],
        temperature: 0.3,
      });
    
      const responseText = similarityResponse.choices[0].message.content?.trim();
      const parsedResponse = JSON.parse(responseText);
      unmatched.push(...(parsedResponse.unmatched || []));
    }

    if (unmatched.length > 0) {
      const similarityCheckResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
            당신은 유사한 질문을 필터링하는 도우미입니다.
    
            📌 **목표:** 
            - 주어진 리스트에서 의미가 비슷한 질문을 찾아 하나만 남기고 나머지는 제거하세요.
            - 질문들이 매우 유사한 경우, 하나만 남기고 나머지는 중복으로 간주하여 제외해야 합니다.
          
            📌 **응답 형식 (JSON):**
            아래의 리스트 중에서 의미가 비슷한 질문을 하나만 남기고 나머지는 제외한 질문 리스트만 반환하세요.
            
            {
              "unique_questions": ["질문1", "질문2", ...]
            }
            `,
          },
          {
            role: "user",
            content: JSON.stringify({ unmatched }),
          },
        ],
        temperature: 0.3,
      });
    
      const responseText = similarityCheckResponse.choices[0].message.content?.trim();
      const parsedResponse = JSON.parse(responseText);
    
      unmatched = parsedResponse.unique_questions || [];
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