import express from 'express';
import translateRoutes from './translate';

const router = express.Router();

router.use('/translate', translateRoutes);

export default router;