import express from 'express';
import createFAQRoutes from './createFAQ';
import getAllFAQCategoryRoutes from './getAllFAQCategory';
import getAllFAQsRotues from './getAllFAQs';
import getFAQRoutes from './getFAQ';
import deleteFAQRoutes from './deleteFAQ';
import updateFAQRoutes from './updateFAQ';
import createRelateFAQRoutes from './createRelateFAQ';
import changeFAQCategoryRoutes  from './changeFAQCategory';
import createCheckFAQCateogryConflictRoutes from './createCheckFAQCategoryConflict';
import updateCheckFAQCateogryConflictRoutes from './updateCheckFAQCategoryConflict';


const router = express.Router();

router.use('/faqs', changeFAQCategoryRoutes);
router.use('/faqs', createFAQRoutes);
router.use('/faqs', getAllFAQCategoryRoutes);
router.use('/faqs', getAllFAQsRotues);
router.use('/faqs', getFAQRoutes);
router.use('/faqs', deleteFAQRoutes);
router.use('/faqs', updateFAQRoutes);
router.use('/faqs', createRelateFAQRoutes);
router.use('/faqs', createCheckFAQCateogryConflictRoutes);
router.use('/faqs', updateCheckFAQCateogryConflictRoutes);


export default router;