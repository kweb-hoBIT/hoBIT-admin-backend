import express from 'express';
import createFAQRoutes from './createFAQ';
import getAllFAQCategoryRoutes from './getAllFAQCategory';
import getAllFAQsRotues from './getAllFAQs';
import getFAQRoutes from './getFAQ';
import deleteFAQRoutes from './deleteFAQ';
import updateFAQRoutes from './updateFAQ';
import createRelateFAQRoutes from './createRelateFAQ';
import createCheckFAQCateogryDuplicateRoutes from './createCheckFAQCategoryDuplicate';
import updateCheckFAQCateogryDuplicateRoutes from './updateCheckFAQCategoryDuplicate';


const router = express.Router();

router.use('/faqs', createFAQRoutes);
router.use('/faqs', getAllFAQCategoryRoutes);
router.use('/faqs', getAllFAQsRotues);
router.use('/faqs', getFAQRoutes);
router.use('/faqs', deleteFAQRoutes);
router.use('/faqs', updateFAQRoutes);
router.use('/faqs', createRelateFAQRoutes);
router.use('/faqs', createCheckFAQCateogryDuplicateRoutes);
router.use('/faqs', updateCheckFAQCateogryDuplicateRoutes);


export default router;