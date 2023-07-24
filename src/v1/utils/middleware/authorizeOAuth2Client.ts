import InstanceManager from '../InstanceManager';
import { Request, Response, NextFunction } from 'express';
import { getPlatform } from '../Logger';

export const authorizeOAuth2Client = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  let platform: string, salesforceUrl: string, destinationFolderId: string, clientId: string, 
    clientSecret: string, tenantId: string, accessToken: string, refreshToken: string, expiryDate: string,
    PLATFORM_CONFIG: string;
  if (process.argv[2] == 'PRODUCTION') {
    ({ platform, salesforceUrl, clientId, clientSecret, destinationFolderId, tenantId, accessToken, refreshToken, expiryDate } = req.body);
    res.locals = { ...req.body };
  } else {
    //  local dev
    ({ salesforceUrl, PLATFORM_CONFIG } = process.env);
    ({ platform } = req.body);
    ({ clientId, clientSecret, destinationFolderId, tenantId, accessToken, refreshToken, expiryDate } = JSON.parse(PLATFORM_CONFIG)[platform]);
    res.locals = { ...res.locals, ...req.body, platform, salesforceUrl, clientId, clientSecret, destinationFolderId, tenantId, accessToken, refreshToken, expiryDate };
  }
  const requestSourceIdentifier = req.body.instanceKey || req.body.salesforceUrl;
  await InstanceManager.upsert(requestSourceIdentifier, { destinationFolderId, tenantId, salesforceUrl, clientId, clientSecret, accessToken, refreshToken, expiryDate });
  res.locals.platformInstance = await getPlatform(platform, requestSourceIdentifier);

  next();
}
