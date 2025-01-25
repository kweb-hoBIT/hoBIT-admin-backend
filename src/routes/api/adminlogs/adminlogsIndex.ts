import express from 'express';
import createFAQLogRoutes from './createFaqLog';
import createSeniorFAQLogRoutes from './createSeniorFaqLog';
import getAllFAQLogssRotues from './getAllAdminLogs';
import compareFAQRouter from './compareFaqLog';
import compareSeniorFAQRouter from './compareSeniorFaqLog';

const router = express.Router();

router.use('/adminlogs', createFAQLogRoutes);
router.use('/adminlogs', createSeniorFAQLogRoutes);
router.use('/adminlogs', getAllFAQLogssRotues);
router.use('/adminlogs', compareFAQRouter);
router.use('/adminlogs', compareSeniorFAQRouter);



export default router;