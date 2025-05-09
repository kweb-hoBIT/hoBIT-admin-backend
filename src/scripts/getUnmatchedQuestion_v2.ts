import { Pool } from "../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import env from '../../config/env';
import { OpenAI } from "openai";

export type NluResponse = Array<NluSuccessUnit | NluAltUnit>;

export type NluSuccessUnit = {
  recipient_id: string;
  custom: NluCustomJson;
};

export type NluCustomJson = {
  faq_id: number;
};

export type NluAltUnit = {
  recipient_id: string;
  text: string;
};

const openai = new OpenAI({
  apiKey: env.OPENAI_KEY,
});

export async function getUnmatchedQuestion_v2() {
  const connection: PoolConnection = await Pool.getConnection();
  console.log("getUnmatchedQuestion start")
  try {
    const userQuestionRow = await connection.execute<RowDataPacket[]>(
      `SELECT user_question FROM hobit.question_logs WHERE ismatched = 0`
    ).then(([rows]) => {
      return rows.length > 0 ? rows.map(row => row.user_question) : [];
    });
    
    let userQuestion = userQuestionRow as string[];
    
    if (userQuestion.length > 0) {
      const similarityCheckResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `

              # 📌 당신의 역할
              당신은 대학 챗봇을 위한 **유사 질문 필터링 도우미**입니다.
              주어진 질문 리스트에서 **중복되거나 의미가 유사한 질문을 제거**하고, **최소한의 대표 질문만 남겨야 합니다**.
              또한 챗봇의 취지에 맞지 않는 질문들은 제외해야 합니다.
              
              ## **🔥 중요 규칙**
        
                1. **영어 질문이 포함된 경우 반드시 한국어로 번역하세요.**
                  - 예시:  
                    - "I want to reserve a space in the College of Informatics" → "정보대학 건물을 빌리고 싶어"

                2. **대학생들을 위한 챗봇이랑 관련 없는 질문들은 삭제해야합니다.**
                  - 삭제 기준은 '대학 생활, 학사 정보 등과 관련된 실질적인 질문이 아닌 경우입니다.
                  - 예시:  
                    비속어, 욕설, 성적인 내용, 정치적 발언 등은 삭제해야 합니다.
                    챗봇의 기능 범위를 벗어나는 잡담은 삭제해야 합니다.
                    AI와 관련된 메타 질문은 삭제해야 합니다.

                3. **유사한 질문을 필터링하여 하나로 통합하세요.**
                  - 의미가 동일하거나 거의 비슷한 질문은 하나만 남기고 삭제해야 합니다.
                  - 단어가 다르더라도 의미가 같다면 제거합니다.
                  - 주어가 다르면 되도록 유지해야 합니다.
                  - 단, 다른 주제의 질문은 유지해야 합니다.

                  예시 1:
                  
                  입력: ["정보대학 건물을 빌리고 싶어", "정보대학 건물을 예약하고 싶어", "현장실습 신청하고 싶어", "I want to reserve a space in the College of Informatics"]
                  출력: ["정보대학 건물을 빌리고 싶어", "현장실습 신청하고 싶어"]
      
                  예시 2:
          
                  입력: ["I want to rent a room in college of Information", "정보대학 건물을 빌리고 싶어"]
                  출력: ["정보대학 건물을 빌리고 싶어"]

                  예시 3:

                  입력: ["정보대학 건물을 예약하고 싶어", "도서관 건물을 예약하고 싶어", "정보대 건물을 빌리고 싶어"]
                  출력: ["정보대학 건물을 예약하고 싶어", "도서관 건물을 예약하고 싶어"]

                  예시 4:
                  입력: ["해외인턴", "개인적으로 인턴을 진행하는 것도 현장실습 학점으로 인정 가능한가요?", "해외인턴은 어떻게 신청해?"]
                  출력: ["해외인턴", "개인적으로 인턴을 진행하는 것도 현장실습 학점으로 인정 가능한가요?", "해외인턴은 어떻게 신청해?"]


                4. **최종적으로 정제된 질문 리스트만 반환하세요.**
                  - JSON 형식으로 반환합니다.
                  - unique_questions 키에 필터링된 질문 리스트를 포함해야 합니다.
                  - 리스트 내부의 모든 질문은 한글이어야 합니다. 한글 이외의 다른 언어가 포함되어있으면 안됩니다.

              ## **📌 응답 형식 (JSON)**
                반드시 다음과 같은 JSON 객체로 반환하세요.
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
        temperature: 0.2,
      });
    
      const responseText = similarityCheckResponse.choices[0].message.content?.trim();
      const parsedResponse = JSON.parse(responseText);
    
      userQuestion = parsedResponse.unique_questions || [];
    } else {
      return;
    }

    const unmatched: string[] = [];

    if (userQuestion.length > 0) {
      for (const question of userQuestion) {
        const LasaResponse = await fetch(`${env.NLU_URL}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sender: 'hobit-admin-backend',
            message: question,
          })
        });

        if (!LasaResponse) {
          const errorData = await LasaResponse.json();
          console.error('Error occurred while fetching Lasa response: ', errorData);
          return;
        }

        const nluResult: NluResponse = await LasaResponse.json();

        if (!nluResult) {
          console.error('NLU 서버 응답이 유효하지 않음');
          throw new Error('NLU 서버 요청 실패');
        }

        if (nluResult.length > 1) {
          unmatched.push(question);
        }
      }
    } else {
      return;
    }

    const data = unmatched.length > 0 ? unmatched.map((question) => {
      return [
        'AI가 유저 질문과 매칭되는 FAQ가 없는것을 발견',
        `'${question}' 질문을 추가해주세요!`,
        'KO'
      ] 
    }) : [];

    if (data.length > 0) {
      await connection.query(
        `INSERT INTO hobit.user_feedbacks (feedback_reason, feedback_detail, language) VALUES ?`,
        [data]
      );
    }
    await connection.execute(
      `UPDATE hobit.question_logs SET ismatched = 1 WHERE ismatched = 0`,
    )
    console.log('Unmatched questions processed successfully! : ', unmatched);
  } catch (err: any) {
    console.error('Error occurred while processing unmatched questions: ', err);
  } finally {
    connection.release();
  }
};