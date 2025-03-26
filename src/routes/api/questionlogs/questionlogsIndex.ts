import express from 'express';

import getAllQuestionLogsRoutes from './getAllQuestionLogs';
import QuestionLogsFrequencyRoutes from './questionLogsFrequency';
import QuestionLogsFeedbackRoutes from './questionLogsFeedback';
import QuestionLogsLanguageRoutes from './questionLogsLanguage';
import QuestionLogFrequencyRoutes from './questionLogFrequency';
import QuestionLogFeedbackRoutes from './questionLogFeedback';
import QuestionLogLanguageRoutes from './questionLogLanguage';

const router = express.Router();

router.use('/questionlogs', getAllQuestionLogsRoutes);
router.use('/questionlogs', QuestionLogsFrequencyRoutes);
router.use('/questionlogs', QuestionLogsFeedbackRoutes);
router.use('/questionlogs', QuestionLogsLanguageRoutes);
router.use('/questionlogs', QuestionLogFrequencyRoutes);
router.use('/questionlogs', QuestionLogFeedbackRoutes);
router.use('/questionlogs', QuestionLogLanguageRoutes);



export default router;