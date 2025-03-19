export type GetAllUserFeedbackRequest = {}

export type GetAllUserFeedbackResponse = {
  statusCode: number;
  message: string;
  data: {
    userFeedbacks: {
      user_feedback_id: number;
      question_ko: string;
      user_question: string;
      feedback_reason: string;
      feedback_detail: string;
      resolved: number;
      created_at: string;
    }[];
  };
}

export type UpdateUserFeedbackRequest = {
  params: {
    user_feedback_id: string;
  }
}

export type UpdateUserFeedbackResponse = {
  statusCode: number;
  message: string;
}

export type DeleteUserFeedbackRequest = {
  params: {
    user_feedback_id: string;
  }
}

export type DeleteUserFeedbackResponse = {
  statusCode: number;
  message: string;
}