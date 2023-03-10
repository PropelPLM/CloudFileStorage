'use strict';

import express from 'express';
const router = express.Router();

import { AWS } from '../platforms/AWS/AWS';
import { logSuccessResponse, logErrorResponse } from '../utils/Logger';

router.get('/:url', async (req, res)=> {
    try {
        const url = req.params.url;
        const signedUrl = AWS.getSignedUrl(url);
        logSuccessResponse(url, '[END_POINT.SIGNED_URL]');
        res.status(200).send({ url: signedUrl });
    } catch(err) {
        logErrorResponse( err, '[END_POINT.SIGNED_URL]');
        res.status(400).send('Signed URL failure');
    }
});
