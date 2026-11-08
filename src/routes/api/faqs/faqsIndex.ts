import express from 'express';
import createFAQRoutes from './createFAQ';
import changeFAQCategoryRoutes  from './updateFAQCategory';
import getAllFAQCategoryRoutes from './getAllFAQCategory';
import getAllFAQsRotues from './getAllFAQs';
import getFAQRoutes from './getFAQ';
import deleteFAQRoutes from './deleteFAQ';
import updateFAQRoutes from './updateFAQ';
import createRelateFAQRoutes from './createRelateFAQ';
import createCheckFAQCateogryConflictRoutes from './createCheckFAQCategoryConflict';
import updateCheckFAQCateogryConflictRoutes from './updateCheckFAQCategoryConflict';
import updateFAQCategoryOrderRoutes from './updateFAQCategoryOrder';
import faqExcelRoutes from './faqExcel';

const router = express.Router();

// 엑셀 받기·올리기 — /faqs/:faq_id(getFAQ)보다 먼저 등록해야 /faqs/excel이 FAQ 번호로 잡히지 않음
router.use('/faqs', faqExcelRoutes);
router.use('/faqs', createFAQRoutes);
router.use('/faqs', changeFAQCategoryRoutes);
router.use('/faqs', getAllFAQCategoryRoutes);
router.use('/faqs', getAllFAQsRotues);
router.use('/faqs', getFAQRoutes);
router.use('/faqs', deleteFAQRoutes);
router.use('/faqs', updateFAQRoutes);
router.use('/faqs', createRelateFAQRoutes);
router.use('/faqs', createCheckFAQCateogryConflictRoutes);
router.use('/faqs', updateCheckFAQCateogryConflictRoutes);
router.use('/faqs', updateFAQCategoryOrderRoutes);



export default router;