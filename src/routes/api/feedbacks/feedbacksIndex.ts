import express from 'express';

import getAllUserFeedbacksRoutes from './getAllUserFeedbacks';
import updateUserFeedbackResolvedRoutes from './updateUserFeedbackResolved';
import deleteUserFeedbackRoutes from './deleteUserFeedback';



const router = express.Router();

router.use('/feedbacks', getAllUserFeedbacksRoutes);
router.use('/feedbacks', updateUserFeedbackResolvedRoutes);
router.use('/feedbacks', deleteUserFeedbackRoutes);


export default router;