import { NextFunction, Request, Response, Router } from 'express';
import { extension } from 'mime-types';
import { ResponseError } from '../utils/middleware/responseGenerator';

const router = Router();

import { logSuccessResponse, logErrorResponse } from '../utils/Logger';
import { DADownloadDetails } from '../platforms/StoragePlatform';

const OFFICE_365 = 'office365';
// the check only applies to Office365 due to Sharepoint limitations
router.post(
    '/testLock',
    async (_: Request, res: Response, next: NextFunction) => {
        let platform: string,
            salesforceUrl: string,
            resourcesToTestLock: string[];
        ({ platform, salesforceUrl, resourcesToTestLock } = res.locals);
        const configuredPlatform = res.locals.platformInstance;
        try {
            if (platform.toLowerCase() == OFFICE_365) {
                const result: any = await configuredPlatform.testLock!(
                    salesforceUrl,
                    resourcesToTestLock
                );
                logSuccessResponse(result, `[${platform}.TEST_LOCK]`);
                res.locals.result = result;
            }
        } catch (err) {
            logErrorResponse(err, `[${platform}.TEST_LOCK]`);
            res.locals.err = new ResponseError(
                400,
                `Failed to test the locking status of a file (via renaming): ${err}`
            );
        } finally {
            next();
        }
    }
);

router.post(
    '/create',
    async (_: Request, res: Response, next: NextFunction) => {
        let platform: string,
            salesforceUrl: string,
            type: string,
            fileName: string,
            destinationFolderId: string;
        ({ platform, salesforceUrl, type, fileName, destinationFolderId } =
            res.locals);
        const configuredPlatform = res.locals.platformInstance;

        try {
            const result: any = await configuredPlatform.createFile!(
                salesforceUrl,
                type,
                fileName,
                destinationFolderId
            );
            logSuccessResponse(result, `[${platform}.CREATE_FILE]`);
            res.locals.result = result;
        } catch (err: any) {
            logErrorResponse(err, `[${platform}.CREATE_FILE]`);
            res.locals.err = new ResponseError(400, `Failed to create: ${err}`);
        } finally {
            next();
        }
    }
);

router.post('/get', async (_: Request, res: Response, next: NextFunction) => {
    let platform: string,
        salesforceUrl: string,
        fileOptions: Record<string, string[]>;
    ({ platform, salesforceUrl, fileOptions } = res.locals);
    const logMessage = `[${platform}.GET_FILE]`;
    const response: Record<string, Record<string, string>> = {};
    const configuredPlatform = res.locals.platformInstance;

    /** TODO: Batch requests instead of iterating and sending 1 request per file update */
    const errorResults: string[] = [];
    let fileIds: string[] = fileOptions['fileIds'];
    for (const fileId of fileIds) {
        try {
            const result = await configuredPlatform.getFile!(
                salesforceUrl,
                fileId
            );
            response[fileId] = result;
            logSuccessResponse(result, logMessage);
        } catch (error) {
            logErrorResponse(error, logMessage);
            errorResults.push(fileId);
        }
    }

    if (errorResults.length > 0) {
        res.locals.err = new ResponseError(
            400,
            `Could not get all files: ${errorResults.join(',')}`
        );
    } else {
        res.locals.result = response;
    }
    next();
});

router.post(
    '/search',
    async (_: Request, res: Response, next: NextFunction) => {
        let platform: string, salesforceUrl: string, searchStrings: string[];
        ({ platform, salesforceUrl, searchStrings } = res.locals);
        const configuredPlatform = res.locals.platformInstance;

        const errorResults: string[] = [];
        const response: Record<string, any> = {};

        /** Iterate through list of strings (file names) and retrieve search results */
        for (const searchString of searchStrings) {
            try {
                const result: Record<string, string>[] =
                    await configuredPlatform.searchFile!(
                        salesforceUrl,
                        searchString
                    );
                logSuccessResponse(result, `[${platform}.SEARCH_FILE]`);
                response[searchString] = result;
            } catch (err) {
                logErrorResponse(err, `[${platform}.SEARCH_FILE]`);
                errorResults.push(searchString);
            }
        }

        if (errorResults.length > 0) {
            res.locals.err = new ResponseError(
                400,
                `Did not retrieve any search results for file names: ${errorResults.join(
                    ','
                )}`
            );
        } else {
            res.locals.result = response;
        }
        next();
    }
);

router.post(
    '/supersede',
    async (_: Request, res: Response, next: NextFunction) => {
        let platform: string,
            salesforceUrl: string,
            fileTypes: string[],
            fileNames: string[],
            docIds: string[],
            numSuperseded: number;
        ({
            platform,
            salesforceUrl,
            fileTypes,
            fileNames,
            docIds,
            numSuperseded
        } = res.locals);
        const configuredPlatform = res.locals.platformInstance;

        let resultArray: string[] = [];
        var i = 0;

        while (i < numSuperseded) {
            try {
                const result = await configuredPlatform.supersedeFile!(
                    salesforceUrl,
                    fileTypes[i],
                    fileNames[i],
                    docIds[i]
                );
                logSuccessResponse(
                    result,
                    `[${platform}.SUPERSEDE_FILE] at index ${i}`
                );
                resultArray.push(result);
            } catch (err) {
                logErrorResponse(
                    err,
                    `[${platform}.SUPERSEDE_FILE] at index ${i}`
                );
            }
            i++;
        }

        // TODO: below code is flexible to change according to desired behavior: e.g. custom error message outlining which files have failed to be superseded
        if (resultArray.length !== numSuperseded) {
            // failed to supersede at least one file
            res.locals.err = new ResponseError(
                400,
                `Failed to supersede at least one file: please try again.`
            );
        } else {
            // all files were successfully superseded
            logSuccessResponse(resultArray, `[${platform}.SUPERSEDE_FILE]`);
            const finalResult: Record<string, string[]> = {
                recordArray: resultArray
            };
            res.locals.result = finalResult;
        }
        next();
    }
);

router.post('/clone', async (_: Request, res: Response, next: NextFunction) => {
    let platform: string,
        salesforceUrl: string,
        fileOptions: Record<string, Record<string, any>>;
    ({ platform, salesforceUrl, fileOptions } = res.locals);

    const configuredPlatform = res.locals.platformInstance;
    const errorResults: string[] = [];
    const response: Record<string, Record<string, string>> = {};
    for (const fileId in fileOptions) {
        try {
            if (fileOptions.hasOwnProperty(fileId)) {
                const options: Record<string, any> = fileOptions[fileId];
                const result: Record<string, string> =
                    await configuredPlatform.cloneFile!(
                        salesforceUrl,
                        fileId,
                        options.fileName,
                        options.folderName
                    );
                logSuccessResponse(result, `[${platform}.CLONE_FILE]`);
                response[fileId] = result;
            }
        } catch (err) {
            logErrorResponse(err, `[${platform}.CLONE_FILE]`);
            errorResults.push(fileId);
        }
    }

    if (errorResults.length > 0) {
        res.locals.err = new ResponseError(
            400,
            `Failed to clone following files: ${errorResults.join(',')}`
        );
    } else {
        res.locals.result = response;
    }
    next();
});

function resolveDownloadList(daDownloadDetailsList: Array<DADownloadDetails>, fileId: string): Array<DADownloadDetails>{
    if (daDownloadDetailsList?.length == 0) {
        if (!fileId) { throw new Error('No files to download'); }
        daDownloadDetailsList = [{fileId}];
    }
    daDownloadDetailsList.forEach((detail: DADownloadDetails) => {
        if (detail.mimeType == null) return;
        const mimeType: string = `.${extension(detail.mimeType)}`;
        if (detail.fileName?.endsWith(mimeType)) return;

        detail.fileName += mimeType;
    });
    return daDownloadDetailsList;
}

router.post(
    '/download',
    async (_: Request, res: Response, next: NextFunction) => {
        let platform: string,
            orgId: string,
            salesforceUrl: string,
            sessionId: string,
            hostName: string,
            fileId: string,
            zipFileName: string,
            daDownloadDetailsList: Array<DADownloadDetails>;
        ({
            platform,
            orgId,
            salesforceUrl,
            sessionId,
            hostName,
            fileId,
            zipFileName,
            daDownloadDetailsList
        } = res.locals);
        const configuredPlatform = res.locals.platformInstance;

        try {
            daDownloadDetailsList = resolveDownloadList(daDownloadDetailsList, fileId);
            if (
                daDownloadDetailsList.length > 1 &&
                (!sessionId || !hostName || !zipFileName)
            )
                throw new Error('Not enough details for bulk download');
            const downloadLink: any = await configuredPlatform.downloadFile!({
                instanceKeyOrOrgUrlOrOrgId: orgId || salesforceUrl,
                daDownloadDetailsList,
                sessionId,
                hostName,
                zipFileName
            });
            logSuccessResponse(
                `downloadLink: ${downloadLink}`,
                `[${platform}.DOWNLOAD_FILE]`
            );
            res.locals.result = downloadLink;
        } catch (err: any) {
            logErrorResponse(err, `[${platform}.DOWNLOAD_FILE]`);
            res.locals.err = new ResponseError(406, err.message);
        } finally {
            next();
        }
    }
);

router.post(
    '/delete',
    async (_: Request, res: Response, next: NextFunction) => {
        let platform: string, salesforceUrl: string, fileId: string;
        ({ platform, salesforceUrl, fileId } = res.locals);
        const configuredPlatform = res.locals.platformInstance;

        try {
            const result: any = await configuredPlatform.deleteFile!(
                salesforceUrl,
                fileId
            );
            logSuccessResponse(result, `[${platform}.DELETE_FILE]`);
            res.locals.result = result;
        } catch (err: any) {
            logErrorResponse(err, `[${platform}.DELETE_FILE]`);
            const message = err.message || 'Unable to delete Cloud document';
            res.locals.err = new ResponseError(
                406,
                message.replace('access', 'delete')
            );
        } finally {
            next();
        }
    }
);

router.post(
    '/update',
    async (_: Request, res: Response, next: NextFunction) => {
        let platform: string,
            salesforceUrl: string,
            fileOptions: Record<string, Record<string, any>>;
        ({ platform, salesforceUrl, fileOptions } = res.locals);
        const logMessage = `[${platform}.FILES_UPDATE]`;
        const configuredPlatform = res.locals.platformInstance;

        /** TODO: Batch requests instead of iterating and sending 1 request per file update */
        const errorResults: string[] = [];
        for (const fileId in fileOptions) {
            try {
                if (fileOptions.hasOwnProperty(fileId)) {
                    const options: Record<string, any> = fileOptions[fileId];
                    const result = await configuredPlatform.updateFile!(
                        salesforceUrl,
                        fileId,
                        options
                    );
                    logSuccessResponse(result, logMessage);
                }
            } catch (error) {
                logErrorResponse(error, logMessage);
                errorResults.push(fileId);
            }
        }

        if (errorResults.length > 0) {
            res.locals.err = new ResponseError(
                400,
                `Could not update all files: ${errorResults.join(',')}`
            );
        } else {
            res.locals.result = {};
        }
        next();
    }
);

/** Miscellaneous endpoints */

router.post(
    '/getCurrentUser',
    async (_: Request, res: Response, next: NextFunction) => {
        let platform: string, salesforceUrl: string;
        ({ platform, salesforceUrl } = res.locals);
        const configuredPlatform = res.locals.platformInstance;

        try {
            const result: any = await configuredPlatform.getCurrentUser!(
                salesforceUrl
            );
            logSuccessResponse(result, `[${platform}.GET_CURRENT_USER]`);
            res.locals.result = result;
        } catch (err: any) {
            logErrorResponse(err, `[${platform}.GET_CURRENT_USER]`);
            res.locals.err = new ResponseError(
                400,
                `Failed to get current user: ${err}`
            );
        } finally {
            next();
        }
    }
);

export default router;
