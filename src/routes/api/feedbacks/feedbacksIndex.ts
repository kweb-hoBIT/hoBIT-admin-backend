import express from 'express';

import getAllUserFeedbacksRoutes from './getAllUserFeedbacks';
import updateUserFeedbackResolvedRoutes from './updateUserFeedbackResolved';



const router = express.Router();

router.use('/', getAllUserFeedbacksRoutes);
router.use('/', updateUserFeedbackResolvedRoutes);



export default router;