export type TFaqLog = {
  id: number;
  user_id: number | null;
  faq_id: number | null;
  prev_faq: Record<string, any>;
  new_faq: Record<string, any>;
  action_type: string;
  created_at?: Date;
};

export default TFaqLog;
