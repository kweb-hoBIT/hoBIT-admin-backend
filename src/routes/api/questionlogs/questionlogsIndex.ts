import express from 'express';

import getAllQuestionLogsRoutes from './getAllQuestionLogs';
import QuestionLogsFrequencyRoutes from './questionLogsFrequency';
import QuestionLogsFeedbackRoutes from './questionLogsFeedback';
import QuestionLogsLanguageRoutes from './questionLogsLanguage';

const router = express.Router();

router.use('/', getAllQuestionLogsRoutes);
router.use('/', QuestionLogsFrequencyRoutes);
router.use('/', QuestionLogsFeedbackRoutes);
router.use('/', QuestionLogsLanguageRoutes);


export default router;