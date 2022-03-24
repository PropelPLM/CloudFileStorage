'use strict';

import { Stream } from "stream";

import * as express from 'express';
const router = express.Router();
const Busboy = require('busboy');

import { logSuccessResponse, logErrorResponse } from '../utils/Logger';
import InstanceManager from '../utils/InstanceManager';
import MessageEmitter from '../utils/MessageEmitter';
import JsForce from '../utils/JsForce';
import GoogleDrive from '../platforms/GoogleDrive/GoogleDrive';

// all endpoints are hit by the react frontend
router.post('/token/:instanceKey', async (req: any, res: any) => {
  const instanceKey = req.params.instanceKey;
  try {
    let client_secret, client_id, access_token, refresh_token, expiry_date, sessionId, salesforceUrl;
    ({ client_secret, client_id, access_token, refresh_token, expiry_date, sessionId, salesforceUrl } = req.body);


    const tokensFromCredentials: Record<string, string> = {
        access_token,
        refresh_token,
        scope: GoogleDrive.actions.driveFiles,
        token_type: 'Bearer',
        expiry_date
    };

    InstanceManager.register(instanceKey);
    GoogleDrive.authorize(instanceKey, client_id, client_secret, tokensFromCredentials); //getAdapter().authorize(...)
    const instanceDetails: Partial<Record<MapKey, any>> = { salesforceUrl };
    await Promise.all([
        InstanceManager.upsert(instanceKey, instanceDetails),
        JsForce.connect(sessionId, salesforceUrl, instanceKey)
    ]);
    logSuccessResponse({...tokensFromCredentials, instanceKey}, '[END_POINT.TOKEN]');
    res.status(200).send({ ...tokensFromCredentials, instanceKey });
  } catch (err) {
    logErrorResponse(err, '[END_POINT.TOKEN]');
    res.status(400).send(`Failed to receive tokens: ${err}`);
  }
});

router.post('/uploadDetails/:instanceKey', async (req: any, res: any) => {
  try {
    const instanceKey = req.params.instanceKey;
    let revisionId, destinationFolderId, isNew;
    ({ revisionId, destinationFolderId, isNew } = req.body);
    const instanceDetails = { revisionId, destinationFolderId, isNew };
    InstanceManager.upsert(instanceKey, instanceDetails);
    logSuccessResponse({ instanceKey }, '[END_POINT.UPLOAD_DETAILS]');
    res.status(200).send({ instanceKey });
  } catch (err) {
    res.status(400).send(`Failed to update upload details ${err}`);
    logErrorResponse(err , '[END_POINT.UPLOAD_DETAILS]');
  }
});

router.post('/reset/:instanceKey/', async (req: any, res: any) => {
  try {
    const instanceKey = req.params.instanceKey;
    InstanceManager.upsert(instanceKey, {fileDetails: {}});
  } catch (err) {
    res.status(400).send(`Failed to reset instance manager variables ${err}`);
    logErrorResponse(err , '[END_POINT.RESET]');
  }
});

router.post('/:instanceKey', async (req: any, res: any) => {
  const instanceKey = req.params.instanceKey;
  const form = new Busboy({ headers: req.headers });
  let salesforceUrl: string, isNew: string, fileDetails: Record<string, FileDetail>;
  try {
    ({ salesforceUrl, isNew } = InstanceManager.get(instanceKey, [MapKey.salesforceUrl, MapKey.isNew]));
  } catch (err) {
    res.status(500).send(`Upload failed: ${err}`);
    logErrorResponse(err, '[END_POINT.UPLOAD_INSTANCE_KEY > INSTANCE_MANAGER_GET]');
    console.log(InstanceManager.debug(instanceKey));
  }
  const responses: Record<string,any>[] = [];
  const promises: any[] = [];
  try {
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
            try {
              let fileDetailKey: string = Math.random().toString();
              fileDetailKey = `${fileName}_${fileDetailKey.substring(2)}`;
              const newFileDetails: FileDetail = {fileName, fileSize, frontendBytes: 0, externalBytes: 0};

              ({ fileDetails } = InstanceManager.get(instanceKey, [MapKey.fileDetails]));
              fileDetails = fileDetails ? fileDetails : {} as Record<string, FileDetail> ;
              fileDetails[fileDetailKey] = newFileDetails;
              InstanceManager.upsert(instanceKey, {fileDetails})
              await GoogleDrive.initUpload(instanceKey, fileDetailKey, { fileName, mimeType });
              let progress: number = 0;
              fileStream
                .on('data', async (data: Record<string, any>) => { //added async
                  progress = progress + data.length;
                  ({ fileDetails } = InstanceManager.get(instanceKey, [MapKey.fileDetails]));
                  fileDetails[fileDetailKey].frontendBytes = progress;
                  InstanceManager.upsert(instanceKey, { fileDetails })
                  MessageEmitter.postProgress(instanceKey, fileDetailKey, 'FRONTEND');
                  await GoogleDrive.uploadFile(instanceKey, fileDetailKey, data);
                })
                .on('error', err => {
                  logErrorResponse(err, '[END_POINT.UPLOAD_INSTANCE_KEY > BUSBOY]');
                })
                .on('end', async () => {
                  const file: GoogleFile = await GoogleDrive.endUpload(instanceKey, fileDetailKey);
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
              } catch (err) {
                reject(err);
              }
            })
          );
        })
      .on('finish', async () => {
        await Promise.all(promises);
        const response = {
          salesforceUrl,
          isNew,
          responses
        };
        res.status(200).send(response);
        logSuccessResponse(response, '[END_POINT.UPLOAD_INSTANCE_KEY > UPLOAD]');
      });
    req.pipe(form);
  } catch (err) {
    res.status(500).send(`Upload failed: ${err}`);
    logErrorResponse(err, '[END_POINT.UPLOAD_INSTANCE_KEY > UPLOAD]');
  }
});

export default router;
