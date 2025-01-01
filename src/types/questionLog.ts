export type GetAllQuestionLogRequest = {}

export type GetAllQuestionLogResponse = {
  statusCode: number;
  message: string;
  data: {
    questionLogs: {
      question_log_id: number;
      user_question: string;
      feedback_score: number;
      feedback: string;
      created_at: string;
      faq_id: number;
      faq_question: string;
      faq_maincategory: string;
      faq_subcategory: string;
    }[];
  };
}

export type FrequencyRequest = {
  query: {
    startDate: string;
    endDate: string;
    period: string;
    sortOrder: string;
    limit : string;
  };
};

export type FrequencyResponse = {
  statusCode: number;
  message: string;          
  data: {
    logData: {
      startDate: string;
      endDate: string;
      groupData: {
          startDate: string;
          endDate: string;
          data: {
              rank: number;
              faq_id: number;
              question_ko: string;
              count: number;
          }[];
      }[];
    };
  };
};

export type FeedbackRequest = {
  query: {
    startDate: string;
    endDate: string;
    period: string;
    sortOrder: string;
    limit: string;
  };
};

export type FeedbackResponse = {
  statusCode: number;
  message: string;          
  data: {
    logData: {
      startDate: string;
      endDate: string;
      groupData: {
          startDate: string;
          endDate: string;
          data: {
              rank: number;
              faq_id: number;
              question_ko: string;
              score_average: number;
              score_like_count: number;
              score_dislike_count: number;
          }[];
      }[];
    };
  };
};

export type LanguageRequest = {
  query: {
    startDate: string;
    endDate: string;
    period: string;
    sortOrder: string;
    limit: string;
  };
};

export type LanguageResponse = {
  statusCode: number;
  message: string;          
  data: {
    logData: {
      startDate: string;
      endDate: string;
      groupData: {
        startDate: string;
        endDate: string;
        data: {
          ko_frequency: number;
          en_frequency: number;
        }[];
      }[];
    }
  };
};


