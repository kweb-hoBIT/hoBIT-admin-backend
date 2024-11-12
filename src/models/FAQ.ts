export type TFAQ = {
  id: number;
  maincategory_ko: string;
  maincategory_en: string;
  subcategory_ko: string;
  subcategory_en: string;
  question_ko: string;
  question_en: string;
  answer_ko: Record<string, any>;
  answer_en: Record<string, any>; 
  manager: string;
  created_by: number | null;
  updated_by: number | null;
};

export default TFAQ;
