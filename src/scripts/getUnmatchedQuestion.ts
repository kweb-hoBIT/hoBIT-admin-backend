import { Pool } from "../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import env from '../../config/env';
import { OpenAI } from "openai";

export type userQuestion = {
  user_question: string;
}

const openai = new OpenAI({
  apiKey: env.OPENAI_KEY,
});

export async function getUnmatchedQuestion() {
  const connection: PoolConnection = await Pool.getConnection();
  try {
    const userQuestionRow = await connection.execute<RowDataPacket[]>(
      `SELECT user_question FROM question_logs WHERE ismatched = 0`
    ).then(([rows]) => {
      return rows.length > 0 ? rows.map(row => row.user_question) : [];
    });
    
    let userQuestion = userQuestionRow as userQuestion[];

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
              
              ## **🔥 중요 규칙**
        
                1. **영어 질문이 포함된 경우 반드시 한국어로 번역하세요.**
                  - 예시:  
                    - "I want to reserve a space in the College of Informatics" → "정보대학 건물을 빌리고 싶어"

                2. **유사한 질문을 필터링하여 하나로 통합하세요.**
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


                3. **최종적으로 정제된 질문 리스트만 반환하세요.**
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

    console.log("userQuestion:", userQuestion)

    const question = await connection.execute<RowDataPacket[]>(
      `SELECT faqs.question_ko FROM faqs`
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
            
              # 📌 **당신의 역할**
              당신은 정보 대학 챗봇에 등록된 FAQ 질문(question_ko)과 유저가 챗봇에 입력한 질문(userQuestion)을 비교하여, 매칭되지 않는 유저의 질문(userQuestion)을 반환하는 도우미입니다.
      
              ## **🔥 중요 규칙**

                1. **유사한 질문을 매칭하기**
                  ## ✅ **매칭 규칙**
                  1) **완전히 같은 질문이면 당연히 매칭**
                  2) **아래 기준 중 하나라도 만족하면 같은 질문으로 간주하고 매칭**  
                    - 문장 길이가 다르더라도 의미가 같으면 매칭 (예: "포털에서 이름 바꾸고 싶어요" ↔ "개명해서 포털 상에 이름을 변경하고 싶어요.")  
                    - 표현이 다르지만 핵심 단어가 같으면 매칭 (예: "교류 학점 인정 방법 알려줘" ↔ "국내대학 학점교류 학점인정 절차가 궁금해요!")  
                    - 일부 문장만 유사해도 매칭 (예: "수강신청 기간 때 신청을 못 해서 추가로 하고 싶어요." ↔ "수강신청 기간 때 신청을 못했어요.")  

                  ## 🚫 **매칭되지 않아야 하는 경우**
                  1) **핵심 단어가 다르고, 의미도 전혀 다를 경우**만 unmatched 처리
                  2) **매칭을 최대한 수행한 후, 정말 매칭할 수 없는 질문만 unmatched로 반환해야 함**


                  예시 1: 
                    - 입력: 
                      {
                        "question_ko": ["학과 개요가 무엇인가요?", "이 학과에서는 어떤 전공을 배우나요?", "이 학과의 장점은 무엇인가요?", "정보대학 건물을 빌리고 싶어"],
                        "userQuestion": ["학과에 대한 소개가 궁금해요", "이 학과에서 배우는 전공은 무엇인가요?", "학과의 특징은 무엇인가요?", "정보대 건물을 대여하고 싶어"]
                      }
                    - 출력: 
                      {
                        "unmatched": ["학과에 대한 소개가 궁금해요", "학과의 특징은 무엇인가요?"]
                      }

                  예시 2: 
                    - 입력: 
                      {
                        "question_ko": ["수업 신청 방법은 무엇인가요?", "정보대학 건물을 대여하고 싶어요", "도서관은 어디에 있나요?", "개명했는데 정보 바꾸고 싶어"],
                        "userQuestion": ["수업 신청 어떻게 하나요?", "도서관에서 책을 빌리려면 어떻게 해야 되나요?", "수업은 몇분동안 하나요?", "개명했는데 정보 바꾸고 싶어"]
                      }
                    - 출력: 
                      {
                        "unmatched": ["도서관에서 책을 빌리려면 어떻게 해야 되나요?", "수업은 몇분동안 하나요?"]
                      }

                  예시 3
                    - 입력:
                      {
                        "question_ko": ["학과 졸업 요건은 어떻게 되나요?", "졸업을 위해 필요한 학점은 얼마인가요?", "졸업 요건에 대한 정보는 어디서 확인하나요?", "융합전공에는 뭐가 있어?"],
                        "userQuestion": ["졸업을 위한 필수 학점이 궁금해요", "졸업을 위해 필요한 요건은 무엇인가요?", "졸업 요건을 어떻게 확인하나요?", "정보보호 융합전공 졸업 요건을 알고 싶어"]
                      }
                    - 출력: 
                      {
                        "unmatched": ["정보보호 융합전공 졸업 요건을 알고 싶어"]
                      }

                  예시 4
                    - 입력:
                      {
                        "question_ko": ["융합전공으로 인정되는 과목들이 궁금해요.", "재학하는 동안 전공필수과목이 전공선택과목으로 변경되었습니다. 그래도 인정 가능한가요?", "융합전공은 따로 졸업요건이 없나요?"],
                        "userQuestion": ["융합전공 졸업요건을 알고싶어", "전공선택 과목 알려줘", "A 수업은 융합전공으로 인정돼?"]
                      } 
                    - 출력:
                      {
                        "unmatched": ["전공선택 과목 알려줘"]
                      }

                  예시 5
                    - 입력:
                      {
                        "question_ko": ["현장실습을 신청하려고 하는데, 다른 교과목은 아예 신청이 불가능한가요?", "졸업식은 언제 있나요?", "휴학 / 복학을 신청하려면 어떻게 해야 하나요??"],
                        "userQuestion": ["현장실습 어떻게 신청해?", "졸업 요건을 알고싶어", "휴학은 어떻게 신청해?"]
                      }

                    - 출력:
                      {
                        "unmatched": ["현장실습 어떻게 신청해?", "졸업 요건을 알고싶어"]
                      }  
                        
                  예시 6
                    - 입력:
                      {
                        "question_ko": ["국내대학 학점교류 학점인정 절차가 궁금해요!", "졸업 전 마지막 학기에 현장실습 신청이 가능한가요?"],
                        "userQuestion": ["국내대학 교류를 마쳤습니다. 학점인정 절차를 알려주세요", "마지막 학기에 현장실습 신청이 가능한가요", "자비유학을 가려고 합니다. 어떻게 해야 하나요?"]
                      }

                    - 출력:
                      {
                        "unmatched": []
                      }  
                          
                2. unmatched 된 질문 중에 정보대학과 아무런 관련이 없는 질문은 제외합니다.
                  - 예시 1: 개인적인 질문 ("너 몇 살이야?", "취미가 뭐야?" 등)
                  - 예시 2: 사회적, 정치적 질문이나 개인적인 의견을 묻는 질문 ("정치적 입장은 무엇인가요?", "세계 경제에 대해 어떻게 생각해?" 등)
                  - 예시 3: 욕설 및 비방
                  - 예시 4: 질문의 길이가 특정 의미를 갖지 않고 짧은 경우 ("전공", "예약" 등)
                  - 예시 5: 챗봇 질문으로 포함되기에 어려워 보이는 질문 ("할 수 있는 일이 뭐야", "나 졸업시켜줘")

                3. **최종적으로 정제된 질문 리스트만 반환하세요.**
                  - JSON 형식으로 반환합니다.
                  - 최종적으로 **매칭되지 않은 질문들만 반환**합니다.

                    ## **📌 응답 형식 (JSON)**
                    다음과 같은 JSON 객체만 반환하세요.
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
        temperature: 0.2,
      });

      const responseText = similarityResponse.choices[0].message.content?.trim();
      const parsedResponse = JSON.parse(responseText);
      unmatched.push(...(parsedResponse.unmatched || []));
    }

    console.log("unmatched:", unmatched)

    const data = unmatched.length > 0 ? unmatched.map((question) => {
      return [
        'AI가 유저 질문과 매칭되는 FAQ가 없는것을 발견',
        `'${question}' 질문을 추가해주세요!`,
        'KO'
      ] 
    }) : [];

    if (data.length > 0) {
      await connection.query(
        `INSERT INTO user_feedbacks (feedback_reason, feedback_detail, language) VALUES ?`,
        [data]
      );
    }

    await connection.execute(
      `UPDATE question_logs SET ismatched = 1 WHERE ismatched = 0`,
    )
    console.log('Unmatched questions processed successfully! : ', unmatched);
  } catch (err: any) {
    console.error('Error occurred while processing unmatched questions: ', err);
  } finally {
    connection.release();
  }
};