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
      language: string;
      created_at: string;
      faq_id: number;
      faq_question: string;
      faq_maincategory: string;
      faq_subcategory: string;
    }[];
  };
}

export type EntireFrequencyRequest = {
  query: {
    startDate: string;
    endDate: string;
    period: string;
    sortOrder: string;
    limit : string;
  };
};

export type EntireFrequencyResponse = {
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

export type EntireFeedbackRequest = {
  query: {
    startDate: string;
    endDate: string;
    period: string;
    sortOrder: string;
    limit: string;
  };
};

export type EntireFeedbackResponse = {
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

export type EntireLanguageRequest = {
  query: {
    startDate: string;
    endDate: string;
    period: string;
    sortOrder: string;
    limit: string;
  };
};

export type EntireLanguageResponse = {
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

export type SpecificFrequencyRequest = {
  params: {
    faq_id: string;
  },
  query: {
    startDate: string;
    endDate: string;
    period: string;
  };
};

export type SpecificFrequencyResponse = {
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
              faq_id: number;
              question_ko: string;
              count: number;
          };
      }[];
    };
  };
};

export type SpecificFeedbackRequest = {
  params: {
    faq_id: string;
  },
  query: {
    startDate: string;
    endDate: string;
    period: string;
  };
};

export type SpecificFeedbackResponse = {
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
              faq_id: number;
              question_ko: string;
              score_average: number;
              score_like_count: number;
              score_dislike_count: number;
          };
      }[];
    };
  };
};

export type SpecificLanguageRequest = {
  params: {
    faq_id: string;
  },
  query: {
    startDate: string;
    endDate: string;
    period: string;
  };
};

export type SpecificLanguageResponse = {
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
          faq_id: number;
          question_ko: string;
          ko_frequency: number;
          en_frequency: number;
        };
      }[];
    }
  };
};

export type getUnmatchedQuestionRequest = {};

export type getUnmatchedQuestionResponse = {
  statusCode: number;
  message: string;
  data: { 
    unmatched: string[];
  };
};