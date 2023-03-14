'use strict';

import { getSignedUrl } from '@aws-sdk/cloudfront-signer';
import { logSuccessResponse, logErrorResponse } from '../../utils/Logger';

export class Cloudfront {
    static getSignedUrl(url: string) {
        try {
            const dateLessThan = new Date(Date.now() + 1000 * 60).toLocaleString();
            const keyPairId = (process.env.CLOUDFRONT_SIGNED_URL_KEY_GROUP) ?
                process.env.CLOUDFRONT_SIGNED_URL_KEY_GROUP.toLocaleString() :
                '';
            const privateKey = (process.env.CLOUDFRONT_SIGNED_URL_KEY) ?
                process.env.CLOUDFRONT_SIGNED_URL_KEY.toLocaleString() :
                '';
            const signedUrl = getSignedUrl({ dateLessThan, keyPairId, privateKey, url });
            
            logSuccessResponse(signedUrl, '[PLATFORM_CLOUDFRONT_SIGNED_URL]');
            
            return signedUrl;
        } catch(err) {
            logErrorResponse(err, '[PLATFORM_CLOUDFRONT_SIGNED_URL]');
            throw err;
        }
    }
}
