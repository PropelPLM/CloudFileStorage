'use strict';

import { NextFunction, Request, Response, Router } from 'express';
import { PassThrough, Stream } from "stream";
import { v4 as uuidv4 } from 'uuid';

const Busboy = require('busboy');
const router = Router();

import InstanceManager from '../utils/InstanceManager';
import { logSuccessResponse, logErrorResponse, getPlatform } from '../utils/Logger';
import { ResponseError, responseGenerator } from '../utils/middleware/responseGenerator';
import MessageEmitter from '../utils/MessageEmitter';
import JsForce from '../utils/JsForce';
import { CreatedFileDetails, StoragePlatform } from '../platforms/StoragePlatform';

router.post('/token', async (req: any, res: any, next: NextFunction) => {
  const instanceKey = uuidv4();
  try {
    const instanceDetails = { ...req.body };
    await InstanceManager.upsert(instanceKey, instanceDetails);
    logSuccessResponse({instanceKey}, '[END_POINT.TOKEN]');
    res.locals.result = { instanceKey };
  } catch (err) {
    logErrorResponse(err, '[END_POINT.TOKEN]');
    res.locals.err = new ResponseError(400, `Failed to receive tokens: ${err}.`);
  } finally {
    next();
  }
});

router.post('/details/:instanceKey', async (req: any, res: any, next: NextFunction) => {
  try {
    const instanceKey = req.params.instanceKey;
    const instanceDetails = { ...req.body };
    await InstanceManager.upsert(instanceKey, instanceDetails);
    logSuccessResponse({ instanceKey }, '[END_POINT.UPLOAD_DETAILS]');
    res.locals.result = { instanceKey };
  } catch (err) {
    logErrorResponse(err , '[END_POINT.UPLOAD_DETAILS]');
    res.locals.err = new ResponseError(400, `Failed to update upload details ${err}.`);
  } finally {
    next();
  }
});

router.post('/files/:instanceKey', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.setTimeout(9999999999)
    const instanceKey = req.params.instanceKey;

    const form = new Busboy({ headers: req.headers });
    let salesforceUrl: string, isNew: string, platform: string;
    const fileDetailsMap = {} as Record<string, FileDetail>;
    let fileDetails: FileDetail;
    ({ salesforceUrl, isNew, platform } = await InstanceManager.get(instanceKey, [MapKey.salesforceUrl, MapKey.isNew, MapKey.platform]));
    const configuredPlatform: StoragePlatform = await getPlatform(platform, instanceKey);
    const responses: Record<string,any>[] = [];
    const promises: any[] = [];
    let fileSizes: Record<string, number> = {};

    form
      .on('field', (fieldName: string, value: string) => {
        if (fieldName == 'fileSize') {
          let fileName: string, fileSize: any;
          [fileName, fileSize] =  value.split(`__${instanceKey}__`);
          fileSizes[fileName] = parseInt(fileSize);
        }
      })
      .on('file', async function(_1: any, fileStream: Stream, fileName: string, _2: any, mimeType: string) {
        const fileSize: number = fileSizes[fileName];
        promises.push(
          new Promise(async (resolve, reject) => {
            const uploadStream = new PassThrough();
            fileDetails = { fileName, fileSize, frontendBytes: 0, externalBytes: 0, mimeType, uploadStream };
            const fileDetailKey: string = createFileDetailKey(fileDetails.fileName);
            fileDetailsMap[fileDetailKey] = fileDetails;
            fileDetailsMap[fileDetailKey].file = configuredPlatform.initUpload(instanceKey, uploadStream, fileDetailsMap, fileDetailKey);
            let progress: number = 0;
            fileStream
              .on('data', async (data: Record<string, any>) => {
                progress = progress + data.length;
                fileDetails.frontendBytes = progress;
                MessageEmitter.postProgress(instanceKey, fileDetailsMap, fileDetailKey, 'FRONTEND');
                configuredPlatform.uploadFile(fileDetailsMap, fileDetailKey, data);
              })
              .on('error', err => {
                logErrorResponse(err, '[END_POINT.UPLOAD_INSTANCE_KEY > BUSBOY]');
                reject(err);
              })
              .on('end', async () => {
                try {
                  const file: CreatedFileDetails =
                    await configuredPlatform.endUpload(fileDetailsMap[fileDetailKey]);
                  const sfObject = await JsForce.create(file, instanceKey);
                  const response = {
                    status: file.status,
                    data: {
                      ...file,
                      sfId: sfObject.id,
                      revisionId: sfObject.revisionId,
                    }
                  };
                  responses.push(response);
                  logSuccessResponse(response, '[END_UPLOAD]');
                  resolve(file);
                } catch (err) {
                  logSuccessResponse(err, '[END_UPLOAD]');
                  reject(err)
                }
              });
            })
          );
        })
      .on('finish', async () => {
        try {
          await Promise.all(promises);
          const response = {
            salesforceUrl,
            isNew,
            responses
          };
          logSuccessResponse(response, '[END_POINT.UPLOAD_INSTANCE_KEY > UPLOAD]');
          res.locals.result = response;
          next();
        } catch (err: any) {
          res.locals.err = new ResponseError(500, `Upload failed: ${err}.`);
          logErrorResponse(err, '[END_POINT.UPLOAD_INSTANCE_KEY > UPLOAD]');
          next();
        }
      });
    req.pipe(form);
  } catch (err) {
    console.log(err);
    res.locals.err = new ResponseError(500, `Failed to pipe upload form: ${err}.`);
    logErrorResponse(err, '[END_POINT.UPLOAD_INSTANCE_KEY > PIPING INTO]');
    next();
  }
})

function createFileDetailKey(fileName: string): string {
  let fileDetailKey: string = Math.random().toString(); //use uuid nextt time
  return `${fileName}_${fileDetailKey.substring(2)}`;
}

router.use(responseGenerator);

export default router;
