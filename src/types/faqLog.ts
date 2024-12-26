export type CreateFAQLogRequest = {
  body: {
    user_id: number;
    faq_id: number;
    prev_faq: {
      maincategory_ko: string;
      maincategory_en: string;
      subcategory_ko: string;
      subcategory_en: string;
      question_ko: string;
      question_en: string;
      answer_ko: {
        answer: string;
        url: string;
        email: string;
        phone: string;
      }[];
      answer_en: {
        answer: string;
        url: string;
        email: string;
        phone: string;
      }[];
      manager: string;
    }
    new_faq: {
      maincategory_ko: string;
      maincategory_en: string;
      subcategory_ko: string;
      subcategory_en: string;
      question_ko: string;
      question_en: string;
      answer_ko: {
        answer: string;
        url: string;
        email: string;
        phone: string;
      }[];
      answer_en: {
        answer: string;
        url: string;
        email: string;
        phone: string;
      }[];
      manager: string;
    }
    action_type: string;
  };
}

export type CreateFAQLogResponse = {
  statusCode: number;
  message: string;
}



export type GetAllFAQLogRequest = {
  params: {};
  query: {};
}

export type GetAllFAQLogResponse = {
  statusCode: number;
  message: string;
  data: {
    faqLogs: {
      faq_log_id: number;
      user_id: number;
      username: string;
      faq_id: number;
      faq_maincategory: string;
      faq_subcategory: string;
      faq_question: string;
      action_type: string;
      created_at: string;
    }[];
  };
}


export type CompareFAQLogRequest = {
  params: {
    faq_log_id: string;
  }
  query: {};
}

export type CompareFAQLogResponse = {
  statusCode: number;
  message: string;
  data: {
    prev_faq: {
      maincategory_ko: string;
      maincategory_en: string;
      subcategory_ko: string;
      subcategory_en: string;
      question_ko: string;
      question_en: string;
      answer_ko: {
        answer: string;
        url: string;
        email: string;
        phone: string;
      }[];
      answer_en: {
        answer: string;
        url: string;
        email: string;
        phone: string;
      }[];
      manager: string;
    }
    new_faq: {
      maincategory_ko: string;
      maincategory_en: string;
      subcategory_ko: string;
      subcategory_en: string;
      question_ko: string;
      question_en: string;
      answer_ko: {
        answer: string;
        url: string;
        email: string;
        phone: string;
      }[];
      answer_en: {
        answer: string;
        url: string;
        email: string;
        phone: string;
      }[];
      manager: string;
    }
  };
}