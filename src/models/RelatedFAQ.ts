export type RelatedFAQ = {
  id: number;
  faq_id: number;
  related_faqs: Record<string, any>;
  created_by: number | null;
  updated_by: number | null;
};

export default RelatedFAQ;