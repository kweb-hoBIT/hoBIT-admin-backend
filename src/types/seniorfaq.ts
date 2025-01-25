export type CreateSeniorFAQRequest = {
  body: {
    user_id: number;
    maincategory_ko: string;
    maincategory_en: string;
    subcategory_ko: string;
    subcategory_en: string;
    detailcategory_ko: string;
    detailcategory_en: string;
    answer_ko: {
      title: string;
      answer: string;
      url: string;
      map: {
        latitude: string;
        longitude: string;
      };
    }[];
    answer_en: {
      title: string;
      answer: string;
      url: string;
      map: {
        latitude: string;
        longitude: string;
      };
    }[];
    manager: string;
  }
};

export type CreateSeniorFAQResponse = {
  statusCode: number;
  message: string;
};


export type GetAllSeniorFAQRequest = {}

export type GetAllSeniorFAQResponse = {
  statusCode: number;
  message: string;
  data : {
    seniorFaqs : {
      senior_faq_id: number;
      maincategory_ko: string;
      maincategory_en: string;
      subcategory_ko: string;
      subcategory_en: string;
      detailcategory_ko: string;
      detailcategory_en: string;
      answer_ko: {
        title: string;
        answer: string;
        url: string;
        map: {
          latitude: string;
          longitude: string;
        };
      }[];
      answer_en: {
        title: string;
        answer: string;
        url: string;
        map: {
          latitude: string;
          longitude: string;
        };
      }[];
      manager: string;
      created_at: string;
      updated_at: string;
    }[];
  }
};

export type GetSeniorFAQRequest = {
  params: {
    senior_faq_id: string;
  };
}

export type GetSeniorFAQResponse = {
  statusCode: number;
  message: string;
  data: {
    seniorFaq : {
      senior_faq_id: number;
      maincategory_ko: string;
      maincategory_en: string;
      detailcategory_ko: string;
      detailcategory_en: string;
      subcategory_ko: string;
      subcategory_en: string;
      answer_ko: {
        title: string;
        answer: string;
        url: string;
        map: {
          latitude: string;
          longitude: string;
        };
      }[];
      answer_en: {
        title: string;
        answer: string;
        url: string;
        map: {
          latitude: string;
          longitude: string;
        };
      }[];
      manager: string;
      created_at: string;
      updated_at: string;
    };
  }
};


export type DeleteSeniorFAQRequest = {
  params: {
    senior_faq_id: string;
  }
  body: {
    user_id: number;
  }
}


export type DeleteSeniorFAQResponse = {
  statusCode: number;
  message: string;
};


export type UpdateSeniorFAQRequest = {
  params: {
    senior_faq_id: string;
  }
  body: {
    user_id: number;
    maincategory_ko: string;
    maincategory_en: string;
    subcategory_ko: string;
    subcategory_en: string;
    detailcategory_ko: string;
    detailcategory_en: string;
    answer_ko: {
      title: string;
      answer: string;
      url: string;
      map: {
        latitude: string;
        longitude: string;
      };
    }[];
    answer_en: {
      title: string;
      answer: string;
      url: string;
      map: {
        latitude: string;
        longitude: string;
      };
    }[];
    manager: string;
  }
}

export type UpdateSeniorFAQResponse = {
  statusCode: number;
  message: string;
}


export type GetAllSeniorFAQCategoryRequest = {}

export type GetAllSeniorFAQCategoryResponse = {
  statusCode: number;
  message: string;
  data : {
    categories : {
      maincategory_ko: string[];
      maincategory_en: string[];
      subcategory_ko: string[];
      subcategory_en: string[];
      detailcategory_ko: string[];
      detailcategory_en: string[];
    };
  }
}