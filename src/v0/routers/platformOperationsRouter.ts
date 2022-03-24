'use strict';

import express from 'express';
const router = express.Router();
import { authorizeOAuth2Client } from '../utils/middleware/authorizeOAuth2Client';

import fileRouter from './fileRouter';
import permissionRouter from './permissionRouter';

router.use('/', authorizeOAuth2Client);
router.use('/files', fileRouter);
router.use('/permissions', permissionRouter);

export default router;
