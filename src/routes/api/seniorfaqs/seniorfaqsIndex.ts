import express from 'express';
import createSeniorFAQRoutes from './createSeniorFAQ';
import changeSeniorFAQCategoryRoutes from './updateSeniorFAQCategory';
import getAllSeniorFAQCategoryRoutes from './getAllSeniorFAQCategory';
import getAllSeniorFAQsRoutes from './getAllSeniorFAQs';
import getSeniorFAQRoutes from './getSeniorFAQ';
import deleteSeniorFAQRoutes from './deleteSeniorFAQ';
import updateSeniorFAQRoutes from './updateSeniorFAQ';
import createCheckSeniorFAQCategoryConflictRoutes from './createCheckSeniorFAQCategoryConflict';
import updateCheckSeniorFAQCategoryConflictRoutes from './updateCheckSeniorFAQCategoryConflict';
import updateSeniorFAQCategoryOrderRoutes from './updateSeniorFAQCategoryOrder';


const router = express.Router();

router.use('/seniorfaqs', createSeniorFAQRoutes);
router.use('/seniorfaqs', changeSeniorFAQCategoryRoutes);
router.use('/seniorfaqs', getAllSeniorFAQCategoryRoutes);
router.use('/seniorfaqs', getAllSeniorFAQsRoutes);
router.use('/seniorfaqs', getSeniorFAQRoutes);
router.use('/seniorfaqs', deleteSeniorFAQRoutes);
router.use('/seniorfaqs', updateSeniorFAQRoutes);
router.use('/seniorfaqs', createCheckSeniorFAQCategoryConflictRoutes);
router.use('/seniorfaqs', updateCheckSeniorFAQCategoryConflictRoutes);
router.use('/seniorfaqs', updateSeniorFAQCategoryOrderRoutes);

export default router;
