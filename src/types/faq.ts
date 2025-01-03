export type Faq = {
  id: number;
  maincategory_ko: string;
  maincategory_en: string;
  subcategory_ko: string;
  subcategory_en: string;
  question_ko: string;
  question_en: string;
  answer_ko: [];
  answer_en: [];
  manager: string;
  created_by: number | null;
  updated_by: number | null;
};


export type CreateFAQRequest = {
  body: {
    user_id: number;
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

export type CreateFAQResponse = {
  statusCode: number;
  message: string;
};


export type GetAllFAQRequest = {}

export type GetAllFAQResponse = {
  statusCode: number;
  message: string;
  data : {
    faqs : {
      faq_id: number;
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
      created_at: string;
      updated_at: string;
    }[];
  }
};

export type GetFAQRequest = {
  params: {
    faq_id: string;
  };
}

export type GetFAQResponse = {
  statusCode: number;
  message: string;
  data: {
    faq : {
      faq_id: number;
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
      created_at: string;
      updated_at: string;
    };
  }
};


export type DeleteFAQRequest = {
  params: {
    faq_id: string;
  }
  body: {
    user_id: number;
  }
}


export type DeleteFAQResponse = {
  statusCode: number;
  message: string;
};


export type UpdateFAQRequest = {
  params: {
    faq_id: string;
  }
  body: {
    user_id: number;
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
}

export type UpdateFAQResponse = {
  statusCode: number;
  message: string;
}

export type RelatedFAQRequest = {
  body: {
    question : string 
    count : number
  }
}

export type RelatedFAQResponse = {
  statusCode: number;
  message: string;
  originalQuestion: string;
  relatedQuestions: {
    ko: string[];
    en: string[];
  };
};

export default Faq;
