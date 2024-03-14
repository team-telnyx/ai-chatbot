export type ChatbotQuestion = {
  user_id: string;
  session_id?: string | null;
  message_id: string;
  question: string;
};
