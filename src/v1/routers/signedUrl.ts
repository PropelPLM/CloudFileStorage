'use strict';

import express from 'express';
const router = express.Router();

import { Cloudfront } from '../platforms/Cloudfront/Cloudfront';
import { logSuccessResponse, logErrorResponse } from '../utils/Logger';

router.post('/', async (req, res)=> {
    try {
        const url = req.body.url;
        const signedUrl = Cloudfront.getSignedUrl(url);
        logSuccessResponse(url, '[ROUTER_CLOUDFRONT_SIGNED_URL]');
        res.status(200).send({ url: signedUrl });
    } catch(err) {
        logErrorResponse( err, '[ROUTER_CLOUDFRONT_SIGNED_URL]');
        res.status(400).send('Signed URL failure');
    }
});

export default router;
