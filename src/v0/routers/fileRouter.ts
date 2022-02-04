import express from 'express';
const router = express.Router();
import { Request, Response } from 'express';
import { logSuccessResponse, logErrorResponse, getPlatform } from '../utils/Logger';

const OFFICE_365 = 'office365';
// the check only applies to Office365 due to Sharepoint limitations
router.post('/testLock', async (_: Request, res: Response) => {
  let platform: string, salesforceUrl: string, resourcesToTestLock: string[];
  ({ platform, salesforceUrl, resourcesToTestLock } = res.locals);

  try {
    if (platform.toLowerCase() == OFFICE_365) {
      const result: any = await getPlatform(platform).testLock!(salesforceUrl, resourcesToTestLock);
      logSuccessResponse(result, `[${platform}.TEST_LOCK]`);
      res.status(200).send(result);
    }
  } catch (err) {
    logErrorResponse(err, `[${platform}.TEST_LOCK]`);
    res.status(400).send(`Failed to test the locking status of a file (via renaming): ${err}`);
  }
});

router.post('/create', async (_: Request, res: Response) => {
  let platform: string, salesforceUrl: string, type: string, fileName: string, destinationFolderId: string;
  ({ platform, salesforceUrl, type, fileName, destinationFolderId } = res.locals);

  try {
    const result: any = await getPlatform(platform).createFile!(salesforceUrl, type, fileName, destinationFolderId);
    logSuccessResponse(result, `[${platform}.CREATE_FILE]`);
    res.status(200).send(result);
  } catch (err) {
    logErrorResponse(err, `[${platform}.CREATE_FILE]`);
    res.status(400).send(`Failed to create: ${err}`);
  }
});

router.post('/get', async (_: Request, res: Response) => {
  let platform: string, salesforceUrl: string, fileOptions: Record<string, string[]>;
  ({ platform, salesforceUrl, fileOptions} = res.locals);
  const logMessage = `[${platform}.GET_FILE]`;
  const response: Record<string, Record<string, string>> = {};

  /** TODO: Batch requests instead of iterating and sending 1 request per file update */
  const errorResults: string[] = [];
  let fileIds: string[] = fileOptions['fileIds'];
  for (const fileId of fileIds) {
    try {
      const result = await getPlatform(platform).getFile!(salesforceUrl, fileId);
      response[fileId] = result;
      logSuccessResponse(result, logMessage);
    } catch (error) {
      logErrorResponse(error, logMessage);
      errorResults.push(fileId);
    }
  }

  if (errorResults.length > 0) {
    res.status(400).send([`Could not get all files: ${errorResults.join(',')}`]);
  } else {
    res.status(200).send(response);
  }
});

router.post('/search', async (_: Request, res: Response) => {
  let platform: string, salesforceUrl: string, searchStrings: string[];
  ({ platform, salesforceUrl, searchStrings } = res.locals);

  const errorResults: string[] = [];
  const response: Record<string, any> = {};

  /** Iterate through list of strings (file names) and retrieve search results */
  for (const searchString of searchStrings) {
    try {
      const result: Record<string, string>[] = await getPlatform(platform).searchFile!(salesforceUrl, searchString);
      logSuccessResponse(result, `[${platform}.SEARCH_FILE]`);
      response[searchString] = result;
    } catch (err) {
      logErrorResponse(err, `[${platform}.SEARCH_FILE]`);
      errorResults.push(searchString);
    }
  }

  if (Object.keys(response).length > 0) {
    res.status(200).send(response);
  } else {
    res.status(400).send({
      message: `Did not retrieve any search results for file names: ${errorResults.join(',')}`
    });
  }
});

router.post('/supersede', async (_: Request, res: Response) => {
  let platform: string, salesforceUrl: string, fileTypes: string[], fileNames: string[], docIds: string[], numSuperseded: number;
  ({ platform, salesforceUrl, fileTypes, fileNames, docIds, numSuperseded } = res.locals);

  const platformType: IPlatform = await getPlatform(platform)
  let resultArray: string[] = [];
  var i = 0;

  while (i < numSuperseded) {
    try {
      const result = await platformType.supersedeFile!(salesforceUrl, fileTypes[i], fileNames[i], docIds[i]);
      logSuccessResponse(result, `[${platform}.SUPERSEDE_FILE] at index ${i}`);
      resultArray.push(result);
    } catch (err) {
      logErrorResponse(err, `[${platform}.SUPERSEDE_FILE] at index ${i}`);
    }
    i++;
  }

  // TODO: below code is flexible to change according to desired behavior: e.g. custom error message outlining which files have failed to be superseded
  if (resultArray.length !== numSuperseded) { // failed to supersede at least one file
    res.status(400).send([`Failed to supersede at least one file: please try again.`]);
  } else { // all files were successfully superseded
    logSuccessResponse(resultArray, `[${platform}.SUPERSEDE_FILE]`);
    const finalResult: Record<string, string[]> = { "recordArray" : resultArray }
    res.status(200).send(finalResult);
  }
});

router.post('/clone', async (_: Request, res: Response) => {
  let platform: string, salesforceUrl: string, fileOptions: Record<string, Record<string, any>>;
  ({ platform, salesforceUrl, fileOptions} = res.locals);

  const errorResults: string[] = [];
  const response: Record<string, Record<string, string>> = {};
  for (const fileId in fileOptions) {
    try {
      if (fileOptions.hasOwnProperty(fileId)) {
        const options: Record<string, any> = fileOptions[fileId];
        const result: Record<string, string> = await getPlatform(platform).cloneFile!(salesforceUrl, fileId, options.fileName, options.folderName);
        logSuccessResponse(result, `[${platform}.CLONE_FILE]`);
        response[fileId] = result;
      }
    } catch (err) {
      logErrorResponse(err, `[${platform}.CLONE_FILE]`);
      errorResults.push(fileId);
    }
  }

  if (errorResults.length > 0) {
    res.status(400).send(errorResults);
  } else {
    res.status(200).send(response);
  }
});

router.post('/download', async (_: Request, res: Response) => {
  let platform: string, salesforceUrl: string, fileId: string;
  ({ platform, salesforceUrl, fileId} = res.locals);

  try {
    const downloadLink: any = await getPlatform(platform).downloadFile!(salesforceUrl, fileId);
    logSuccessResponse(`downloadLink: ${downloadLink}`, `[${platform}.DOWNLOAD_FILE]`);
    res.status(200).send({downloadLink});
  } catch (err) {
    logErrorResponse(err, `[${platform}.DOWNLOAD_FILE]`);
    res.status(406).send({message: err.message});
  }
});

router.post('/delete', async (_: Request, res: Response) => {
  let platform: string, salesforceUrl: string, fileId: string;
  ({ platform, salesforceUrl, fileId} = res.locals);

  try {
    const result: any = await getPlatform(platform).deleteFile!(salesforceUrl, fileId);
    logSuccessResponse(result, `[${platform}.DELETE_FILE]`);
    res.status(200).send(result);
  } catch (err) {
    logErrorResponse(err, `[${platform}.DELETE_FILE]`);
    const message = err.message || 'Unable to delete Cloud document';
    res.status(406).send({message: message.replace('access', 'delete')});
  }
});

router.post('/update', async (_: Request, res: Response) => {
  let platform: string, salesforceUrl: string, fileOptions: Record<string, Record<string, any>>;
  ({ platform, salesforceUrl, fileOptions} = res.locals);
  const logMessage = `[${platform}.FILES_UPDATE]`;

  /** TODO: Batch requests instead of iterating and sending 1 request per file update */
  const errorResults: string[] = [];
  for (const fileId in fileOptions) {
    try {
      if (fileOptions.hasOwnProperty(fileId)) {
        const options: Record<string, any> = fileOptions[fileId];
        const result = await getPlatform(platform).updateFile!(salesforceUrl, fileId, options);
        logSuccessResponse(result, logMessage);
      }
    } catch (error) {
      logErrorResponse(error, logMessage);
      errorResults.push(fileId);
    }
  }

  if (errorResults.length > 0) {
    res.status(400).send([`Could not update all files: ${errorResults.join(',')}`]);
  } else {
    res.status(200).send({});
  }
});

/** Miscellaneous endpoints */

/**
 * getCurrentUser
 */
 router.post('/getCurrentUser', async (_: Request, res: Response) => {
  let platform: string, salesforceUrl: string;
  ({ platform, salesforceUrl } = res.locals);

  try {
    const result: any = await getPlatform(platform).getCurrentUser!(salesforceUrl);
    logSuccessResponse(result, `[${platform}.GET_CURRENT_USER]`);
    res.status(200).send(result);
  } catch (err) {
    logErrorResponse(err, `[${platform}.GET_CURRENT_USER]`);
    res.status(400).send(`Failed to get current user: ${err}`);
  }
});

export default router;
