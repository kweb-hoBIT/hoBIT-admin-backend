import express from 'express';
import createSeniorFAQRoutes from './createSeniorFAQ';
import getAllSeniorFAQsRoutes from './getAllSeniorFAQs';
import getSeniorFAQRoutes from './getSeniorFAQ';
import deleteSeniorFAQRoutes from './deleteSeniorFAQ';
import updateSeniorFAQRoutes from './updateSeniorFAQ';

const router = express.Router();

router.use('/', createSeniorFAQRoutes);
router.use('/', getAllSeniorFAQsRoutes);
router.use('/', getSeniorFAQRoutes);
router.use('/', deleteSeniorFAQRoutes);
router.use('/', updateSeniorFAQRoutes);

export default router;
