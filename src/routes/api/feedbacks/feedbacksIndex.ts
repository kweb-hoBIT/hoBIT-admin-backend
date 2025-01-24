import express from 'express';

import getAllUserFeedbacksRoutes from './getAllUserFeedbacks';
import updateUserFeedbackResolvedRoutes from './updateUserFeedbackResolved';
import deleteUserFeedbackRoutes from './deleteUserFeedback';



const router = express.Router();

router.use('/', getAllUserFeedbacksRoutes);
router.use('/', updateUserFeedbackResolvedRoutes);
router.use('/', deleteUserFeedbackRoutes);


export default router;