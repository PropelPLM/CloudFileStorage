import express from 'express';
const router = express.Router();
import { NextFunction, Request, Response } from 'express';
import { ResponseError } from '../utils/middleware/responseGenerator';
import { logSuccessResponse, logErrorResponse } from '../utils/Logger';

/**
 * permissions/create
 * @param fileId: Id of external file
 * @param email: Email address of user to create permission for
 * @param role: Type of permission (write/read)
 * @param type: Type of user (user/anyone)
 */
router.post('/create', async (_: Request, res: Response, next: NextFunction) => {
  let platform: string, salesforceUrl: string, fileId: string, email: string, role: string, type: string;
  ({ platform, salesforceUrl, fileId, email, role, type } = res.locals);
  const logMessage = `[${platform}.PERMISSION_CREATE]`;
  const configuredPlatform = res.locals.platformInstance;

  const permission: Record<string, string> = {
    fileId: fileId,
    email: email,
    role: role,
    type: type
  };

  /**
   * TODO - Need to determine if we need to update a permission or create, depending if a
   *  permission already exists
   */
  try {
    /** Create new permission */
    const permissionId = await configuredPlatform.permissionCreate!(salesforceUrl, fileId, permission);
    logSuccessResponse(permissionId, logMessage);
    res.locals.result = permissionId;
  } catch (error: any) {
    logErrorResponse(error, logMessage);
    res.locals.result = new ResponseError(400, error);
  } finally {
    next();
  }
});

/**
 * permissions/delete
 * @param fileId: Id of external file
 * @param permissionId: Id of permission to delete
 */
router.post('/delete', async (_: Request, res: Response, next: NextFunction) => {
  let platform: string, salesforceUrl: string, fileId: string, permissionId: string;
  ({ platform, salesforceUrl, fileId, permissionId } = res.locals);
  const logMessage = `[${platform}.PERMISSION_DELETE]`;
  const configuredPlatform = res.locals.platformInstance;

  try {
    await configuredPlatform.permissionDelete!(salesforceUrl, fileId, permissionId);
    logSuccessResponse(null, logMessage);
    res.locals.result = {};
  } catch (error: any) {
    logErrorResponse(error, logMessage);
    res.locals.error(400, error);
  } finally {
    next();
  }
});

/**
 * permissions/list
 * @param fileIds[]: List of external file Ids to retrieve permissions for
 */
router.post('/list', async (_: Request, res: Response, next: NextFunction) => {
  let platform: string, salesforceUrl: string, fileIds: string[];
  ({ platform, salesforceUrl, fileIds } = res.locals);
  const logMessage = `[${platform}.PERMISSION_LIST]`;
  const configuredPlatform = res.locals.platformInstance;

  const filePermissionMap: Record<string, Record<string, string>[]> = {};
  const errorResults: string[] = [];
  for (const fileId of fileIds) {
    try {
      const permissionsList: Record<string, string>[] = await configuredPlatform.permissionList!(salesforceUrl, fileId);
      filePermissionMap[fileId] = permissionsList;
      logSuccessResponse(permissionsList, logMessage);
    } catch (error) {
      logErrorResponse(error, logMessage);
      errorResults.push(fileId);
    }
  }

  if (errorResults.length > 0) {
    res.locals.err = new ResponseError(400, `Could not retrieve permissions for all files: ${errorResults.join(',')}`);
  } else {
    res.locals.result = { filePermissionMap };
  }
  next();
});


/**
 * permissions/delete
 * @param fileId: Id of external file
 * @param permissionId: Id of permission to update
 *
 */
 router.post('/update', async (_: Request, res: Response, next: NextFunction) => {
  let platform: string, salesforceUrl: string, permissionMap: Record<string, Record<string, string>>;
  ({ platform, salesforceUrl, permissionMap } = res.locals);
  const logMessage = `[${platform}.PERMISSION_UPDATE]`;
  const configuredPlatform = res.locals.platformInstance;

  const returnMap: Record<string, Record<string, string>> = {};
  const errorResults: string[] = [];

  const contentIds = Object.keys(permissionMap);

  for (const contentId of contentIds) {
    try {
      const fileId: string = contentId.split(":")[0];
      const newPermission: Record<string, string> = permissionMap[contentId];

      const permissionsUpdate: Record<string, string> = await configuredPlatform.permissionUpdate!(salesforceUrl, fileId, newPermission.permId, newPermission.role);
      returnMap[contentId] = permissionsUpdate;
      logSuccessResponse(permissionsUpdate, logMessage);
    } catch (error) {
      logErrorResponse(error, logMessage);
      errorResults.push(contentId);
    }
  }

  if (errorResults.length > 0) {
    res.locals.err = new ResponseError(400, `Could not update permissions for all files: ${errorResults.join(',')}`);
  } else {
    res.locals.result = { returnMap };
  }
  next();
});

export default router;