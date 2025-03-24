import express from 'express';
import createFAQRoutes from './createFAQ';
import getAllFAQCategoryRoutes from './getAllFAQCategory';
import getAllFAQsRotues from './getAllFAQs';
import getFAQRoutes from './getFAQ';
import deleteFAQRoutes from './deleteFAQ';
import updateFAQRoutes from './updateFAQ';
import createRelateFAQRoutes from './createRelateFAQ';
import createCheckFAQCateogryConflictRoutes from './createCheckFAQCategoryConflict';
import updateCheckFAQCateogryConflictRoutes from './updateCheckFAQCategoryConflict';
import changeFAQCategoryRoutes  from './changeFAQCategory';


const router = express.Router();

router.use('/faqs', createFAQRoutes);
router.use('/faqs', getAllFAQCategoryRoutes);
router.use('/faqs', getAllFAQsRotues);
router.use('/faqs', getFAQRoutes);
router.use('/faqs', deleteFAQRoutes);
router.use('/faqs', updateFAQRoutes);
router.use('/faqs', createRelateFAQRoutes);
router.use('/faqs', createCheckFAQCateogryConflictRoutes);
router.use('/faqs', updateCheckFAQCateogryConflictRoutes);
router.use('/faqs', changeFAQCategoryRoutes);


export default router;