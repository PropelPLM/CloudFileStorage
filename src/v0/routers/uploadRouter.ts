'use strict';

import { Stream } from "stream";

import * as express from 'express';
const router = express.Router();
const Busboy = require('busboy');

import { logSuccessResponse, logErrorResponse } from '../utils/Logger';
import InstanceManager from '../utils/InstanceManager';
import MessageEmitter from '../utils/MessageEmitter';
import JsForce from '../utils/JsForce';
import GoogleDrive from '../platforms/GoogleDrive';

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

router.post('/:instanceKey', async (req: any, res: any) => {
  const instanceKey = req.params.instanceKey;
  const form = new Busboy({ headers: req.headers });
  let salesforceUrl: string, isNew: string;
  ({ salesforceUrl, isNew } = InstanceManager.get(instanceKey, [MapKey.salesforceUrl, MapKey.isNew]));
  try {
    let fileSize: number;
    form
      .on('field', (fieldName: string, value: number) => {
        fileSize = fieldName == 'fileSize' ? value : 0;
      })
      .on('file', async function(_1: any, file: Stream, fileName: string, _2: any, mimeType: string) {
        await Promise.all([
          GoogleDrive.initUpload(instanceKey, { fileName, mimeType, fileSize }),
          InstanceManager.upsert(instanceKey, {fileName, frontendBytes: 0, externalBytes: 0, fileSize })
        ]);
        let progress: number = 0;
        file
          .on('data', async (data: Record<string, any>) => { //added async
            progress = progress + data.length
            InstanceManager.upsert(instanceKey, { frontendBytes: progress })
            MessageEmitter.postProgress(instanceKey, 'FRONTEND');
            await GoogleDrive.uploadFile(instanceKey, data);
          })
          .on('error', err => {
            logErrorResponse(err, '[END_POINT.UPLOAD_INSTANCE_KEY > BUSBOY]');
          })
      })
      .on('finish', async () => {
        const file: GoogleFile = await GoogleDrive.endUpload(instanceKey);
        const sfObject = await JsForce.create(file.data, instanceKey);
        const response = {
          status: parseInt(file.status),
          data: {
            ...file.data,
            sfId: sfObject.id,
            revisionId: sfObject.revisionId,
            salesforceUrl,
            isNew
          }
        }
        res.status(response.status).send(response.data);
        logSuccessResponse(response, '[END_POINT.UPLOAD_INSTANCE_KEY > UPLOAD]');
      });
    req.pipe(form);
  } catch (err) {
    res.status(500).send(`Upload failed: ${err}`);
    logErrorResponse(err, '[END_POINT.UPLOAD_INSTANCE_KEY > UPLOAD]');
  }
});

export default router;
