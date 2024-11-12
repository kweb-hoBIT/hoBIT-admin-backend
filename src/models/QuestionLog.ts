// 유저가 입력한 질문 log를 저장하는 table
export type TQuestionLog = {
  id: number;
  faq_id: number | null;
  user_question: string;
  language: string;
  feedback_score: number | null;
  feedback: string | null;
  created_at?: Date;
};

export default TQuestionLog;
