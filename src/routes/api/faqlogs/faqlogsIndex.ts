import express from 'express';
import createFAQLogRoutes from './createFaqLog';
import getAllFAQLogssRotues from './getAllFaqLogs';
import compareFAQRouter from './compareFaqLog';

const router = express.Router();

router.use('/', createFAQLogRoutes);
router.use('/', getAllFAQLogssRotues);
router.use('/', compareFAQRouter);



export default router;