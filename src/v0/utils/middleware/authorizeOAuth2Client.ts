import InstanceManager from '../InstanceManager';
import { Request, Response, NextFunction } from 'express';
import { getPlatform } from '../Logger';

export const authorizeOAuth2Client = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  let platform: string, salesforceUrl: string, clientId: string, clientSecret: string, destinationFolderId: string, tenantId: string;
  if (process.argv[2] == 'PRODUCTION') {
    ({ platform, salesforceUrl, clientId, clientSecret, destinationFolderId, tenantId } = req.body);
    res.locals = { ...req.body };
  } else {
    //  local dev
    ({ platform, salesforceUrl, clientId, clientSecret, destinationFolderId, tenantId } = process.env);
    res.locals = { ...res.locals, ...req.body, platform, salesforceUrl, clientId, clientSecret, destinationFolderId, tenantId };
  }
  if (!InstanceManager.checkRegistration(salesforceUrl)) {
    InstanceManager.register(salesforceUrl);
    InstanceManager.upsert(salesforceUrl, { destinationFolderId, tenantId });
    await getPlatform(platform).authorize(salesforceUrl, clientId, clientSecret, {});
  }
  next();
}
