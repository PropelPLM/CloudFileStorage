'use strict';

import { Request, Response, Router } from 'express';
import { PassThrough, Stream } from "stream";

const Busboy = require('busboy');
const router = Router();

import InstanceManager from '../utils/InstanceManager';
import { logSuccessResponse, logErrorResponse, getPlatform } from '../utils/Logger';
import MessageEmitter from '../utils/MessageEmitter';
import JsForce from '../utils/JsForce';
import { IPlatform } from '../platforms/Platform';
import { CloudStorageProviderClient } from "../customTypes/GoogleObjects";

// all endpoints are hit by the react frontend (DEPRECATE)
router.post('/token/:instanceKey', async (req: any, res: any) => {
  const instanceKey = req.params.instanceKey;
  try {
    let clientId, clientSecret, accessToken, refreshToken, expiryDate, platform, sessionId, salesforceUrl;
    ({ clientId, clientSecret, accessToken, refreshToken, expiryDate, platform, sessionId, salesforceUrl } = req.body);
    const instanceDetails = { clientId, clientSecret, accessToken, refreshToken, expiryDate, platform, sessionId, salesforceUrl };
    await InstanceManager.upsert(instanceKey, instanceDetails);
    logSuccessResponse({instanceKey}, '[END_POINT.TOKEN]');
    res.status(200).send({ instanceKey });
  } catch (err) {
    logErrorResponse(err, '[END_POINT.TOKEN]');
    res.status(400).send(`Failed to receive tokens: ${err}`);
  }
});

router.post('/details/:instanceKey', async (req: any, res: any) => {
  try {
    const instanceKey = req.params.instanceKey;
    let revisionId, destinationFolderId, isNew;
    ({ revisionId, destinationFolderId, isNew } = req.body);
    const instanceDetails = { revisionId, destinationFolderId, isNew };
    await InstanceManager.upsert(instanceKey, instanceDetails);
    logSuccessResponse({ instanceKey }, '[END_POINT.UPLOAD_DETAILS]');
    res.status(200).send({ instanceKey });
  } catch (err) {
    res.status(400).send(`Failed to update upload details ${err}`);
    logErrorResponse(err , '[END_POINT.UPLOAD_DETAILS]');
  }
});

// router.post('/reset/:instanceKey/', async (req: any, res: any) => {
//   try {
//     const instanceKey = req.params.instanceKey;
//     InstanceManager.upsert(instanceKey, {});
//     res.status(200).send();
//   } catch (err) {
//     res.status(400).send(`Failed to reset instance manager variables ${err}`);
//     logErrorResponse(err , '[END_POINT.RESET]');
//   }
// });

router.post('/:instanceKey', async (req: Request, res: Response) => {
  const instanceKey = req.params.instanceKey;

  const form = new Busboy({ headers: req.headers });
  let salesforceUrl: string, isNew: string, platformString: string;
  const fileDetailsMap = {} as Record<string, FileDetail>;
  let fileDetails: FileDetail;
  try {
    ({ salesforceUrl, isNew, platformString } = await InstanceManager.get(instanceKey, [MapKey.salesforceUrl, MapKey.isNew, MapKey.platform]));
    const platform: IPlatform = getPlatform(platformString);
    const responses: Record<string,any>[] = [];
    const promises: any[] = [];
    let fileSizes: Record<string, number> = {};
    const oAuth2Client: CloudStorageProviderClient = await platform.authorize(instanceKey);

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
            fileDetailsMap[fileDetailKey].file = platform.initUpload(instanceKey, oAuth2Client, uploadStream, fileDetailsMap, fileDetailKey);
            let progress: number = 0;
            fileStream
              .on('data', async (data: Record<string, any>) => {
                progress = progress + data.length;
                fileDetails.frontendBytes = progress;
                MessageEmitter.postProgress(instanceKey, fileDetailsMap, fileDetailKey, 'FRONTEND');
                await platform.uploadFile(fileDetailsMap[fileDetailKey], data);
              })
              .on('error', err => {
                logErrorResponse(err, '[END_POINT.UPLOAD_INSTANCE_KEY > BUSBOY]');
                reject(err);
              })
              .on('end', async () => {
                let file: GoogleFile;
                file = await platform.endUpload(fileDetailsMap[fileDetailKey]);
                let sfObject = await JsForce.create(file.data, instanceKey);
                const response = {
                  status: parseInt(file.status),
                  data: {
                    ...file.data,
                    sfId: sfObject.id,
                    revisionId: sfObject.revisionId,
                  }
                };
                responses.push(response);
                logSuccessResponse(response, '[END_UPLOAD]');
                resolve(file);
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
          res.status(200).send(response);
          logSuccessResponse(response, '[END_POINT.UPLOAD_INSTANCE_KEY > UPLOAD]');
        } catch (err: any) {
          res.status(500).send(`Upload failed: ${err}`);
          logErrorResponse(err, '[END_POINT.UPLOAD_INSTANCE_KEY > UPLOAD]');
        }
      });
    req.pipe(form);
  } catch (err) {
    res.status(500).send(`Upload failed: ${err}`);
    logErrorResponse(err, '[END_POINT.UPLOAD_INSTANCE_KEY > UPLOAD FLOW]');
  }
})

function createFileDetailKey(fileName: string): string {
  let fileDetailKey: string = Math.random().toString(); //use uuid nextt time
  return `${fileName}_${fileDetailKey.substring(2)}`;
}

export default router;
