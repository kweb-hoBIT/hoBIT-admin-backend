import express from 'express';
import createFAQRoutes from './createFAQ';
import getAllFAQsRotues from './getAllFAQs';
import getFAQRoutes from './getFAQ';
import deleteFAQRoutes from './deleteFAQ';
import updateFAQRoutes from './updateFAQ';

const router = express.Router();

router.use('/', createFAQRoutes);
router.use('/', getAllFAQsRotues);
router.use('/', getFAQRoutes);
router.use('/', deleteFAQRoutes);
router.use('/', updateFAQRoutes);

export default router;