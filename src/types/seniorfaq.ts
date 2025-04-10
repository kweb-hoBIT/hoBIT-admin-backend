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
  };
};

export type CreateSeniorFAQResponse = {
  statusCode: number;
  message: string;
};

export type GetAllSeniorFAQRequest = {};

export type GetAllSeniorFAQResponse = {
  statusCode: number;
  message: string;
  data: {
    seniorFaqs: {
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
  };
};

export type GetSeniorFAQRequest = {
  params: {
    senior_faq_id: string;
  };
};

export type GetSeniorFAQResponse = {
  statusCode: number;
  message: string;
  data: {
    seniorFaq: {
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
  };
};

export type DeleteSeniorFAQRequest = {
  params: {
    senior_faq_id: string;
  };
  body: {
    user_id: number;
  };
};

export type DeleteSeniorFAQResponse = {
  statusCode: number;
  message: string;
};

export type UpdateSeniorFAQRequest = {
  params: {
    senior_faq_id: string;
  };
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
  };
};

export type UpdateSeniorFAQResponse = {
  statusCode: number;
  message: string;
};

export type GetAllSeniorFAQCategoryRequest = {};

export type GetAllSeniorFAQCategoryResponse = {
  statusCode: number;
  message: string;
  data: {
    categories: {
      maincategory_ko: string;
      maincategory_en: string;
      category_order: number;
      subcategories: {
        subcategory_ko: string;
        subcategory_en: string;
        detailcategories: {
          detailcategory_ko: string[];
          detailcategory_en: string[];
        };
      }[];
    }[];
  };
};


export type CreateCheckSeniorFAQCategoryConflictRequest = {
  body: {
    maincategory_ko: string;
    maincategory_en: string;
    subcategory_ko: string;
    subcategory_en: string;
    detailcategory_ko: string;
    detailcategory_en: string;
  };
};


export type UpdateCheckSeniorFAQCategoryConflictRequest = {
  body: {
    senior_faq_id: number;
    maincategory_ko: string;
    maincategory_en: string;
    subcategory_ko: string;
    subcategory_en: string;
    detailcategory_ko: string;
    detailcategory_en: string;
  };
};

export type CheckSeniorFAQCategoryConflictResponse = {
  statusCode: number;
  message: string;
  data: {
    isConflict: boolean;
    conflictedData: {
      field: string;
      input: {
        ko: string;
        en: string;
      };
      conflict: {
        ko: string;
        en: string;
      }[];
    }[];
  };
};

export type changeSeniorFAQCategoryRequest = {
  body: {
    user_id: number;
    category_field: string;
    prev_category: string;
    new_category: string;
  };
}

export type changeSeniorFAQCategoryResponse = {
  statusCode: number;
  message: string; 
}

export type UpdateSeniorFAQCategoryOrderRequest = {
  body: {
    categoryOrder: string[];
  }
}

export type UpdateSeniorFAQCategoryOrderResponse = {
  statusCode: number;
  message: string;
};