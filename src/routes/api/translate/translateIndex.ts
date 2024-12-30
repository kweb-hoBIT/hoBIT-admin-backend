import express from 'express';
import translateRoutes from './translate';

const router = express.Router();

router.use('/', translateRoutes);

export default router;