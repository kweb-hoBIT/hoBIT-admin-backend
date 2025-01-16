import express from 'express';
import createFAQRoutes from './createFAQ';
import getAllFAQCategoryRoutes from './getAllFAQCategory';
import getAllFAQsRotues from './getAllFAQs';
import getFAQRoutes from './getFAQ';
import deleteFAQRoutes from './deleteFAQ';
import updateFAQRoutes from './updateFAQ';
import createRelateFAQRoutes from './createRelateFAQ';


const router = express.Router();

router.use('/', createFAQRoutes);
router.use('/', getAllFAQCategoryRoutes);
router.use('/', getAllFAQsRotues);
router.use('/', getFAQRoutes);
router.use('/', deleteFAQRoutes);
router.use('/', updateFAQRoutes);
router.use('/', createRelateFAQRoutes);


export default router;