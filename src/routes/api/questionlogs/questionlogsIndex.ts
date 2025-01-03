import express from 'express';

import getAllQuestionLogsRoutes from './getAllQuestionLogs';
import QuestionLogsFrequencyRoutes from './questionLogsFrequency';
import QuestionLogsFeedbackRoutes from './questionLogsFeedback';
import QuestionLogsLanguageRoutes from './questionLogsLanguage';
import QuestionLogFrequencyRoutes from './questionLogFrequency';
import QuestionLogFeedbackRoutes from './questionLogFeedback';
import QuestionLogLanguageRoutes from './questionLogLanguage';


const router = express.Router();

router.use('/', getAllQuestionLogsRoutes);
router.use('/', QuestionLogsFrequencyRoutes);
router.use('/', QuestionLogsFeedbackRoutes);
router.use('/', QuestionLogsLanguageRoutes);
router.use('/', QuestionLogFrequencyRoutes);
router.use('/', QuestionLogFeedbackRoutes);
router.use('/', QuestionLogLanguageRoutes);


export default router;