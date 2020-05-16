'use strict';

import { Stream } from "stream";

export {};
const express = require('express');
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
    let client_secret, client_id, access_token, refresh_token, expiry_date, sessionId, salesforceUrl, tokensFromCredentials;
    ({ client_secret, client_id, access_token, refresh_token, expiry_date, sessionId, salesforceUrl } = req.body);

    tokensFromCredentials = {
        access_token,
        refresh_token,
        scope: GoogleDrive.actions.driveFiles,
        token_type: 'Bearer',
        expiry_date
    };

    InstanceManager.register(instanceKey);
    GoogleDrive.authorize(instanceKey, client_id, client_secret, tokensFromCredentials); //getAdapter().authorize(...)
    const instanceDetails = { sessionId, salesforceUrl };
    await Promise.all([
        InstanceManager.add(instanceKey, instanceDetails),
        JsForce.connect(sessionId, salesforceUrl, instanceKey)
    ]);
    logSuccessResponse({...tokensFromCredentials, instanceKey}, '[END_POINT.TOKEN]');
    res.status(200).send({ ...tokensFromCredentials, instanceKey });
  } catch (err) {
    logErrorResponse(err, '[END_POINT.TOKEN]');
    res.send(`Failed to receive tokens: ${err}`);
  }
});

router.post('/uploadDetails/:instanceKey', async (req: any, res: any) => {
  const instanceKey = req.params.instanceKey;
  let revisionId, destinationFolderId, isNew;
  ({ revisionId, destinationFolderId, isNew } = req.body);
  const instanceDetails = { revisionId, destinationFolderId, isNew };
  InstanceManager.add(instanceKey, instanceDetails);
  logSuccessResponse({ instanceKey }, '[END_POINT.UPLOAD_DETAILS]');
  res.status(200).send({ instanceKey });
});

router.post('/:instanceKey', async (req: any, res: any) => {
  const instanceKey = req.params.instanceKey;
  const form = new Busboy({ headers: req.headers });
  let salesforceUrl: string, isNew: string;
  ({ salesforceUrl, isNew } = InstanceManager.get(instanceKey, ['salesforceUrl', 'isNew']));
  try {
    let fileSize: number;
    form
      .on('field', (fieldName: string, value: number) => {
        fileSize = fieldName == 'fileSize' ? value : 0;
        console.log('fileSize', fileSize);
      })
      .on('file', async function(_1: any, file: Stream, fileName: string, _2: any, mimeType: string) {
        await Promise.all([
          GoogleDrive.initUpload(instanceKey, { fileName, mimeType, fileSize }),
          InstanceManager.add(instanceKey, {frontendBytes: 0, externalBytes: 0, fileSize })
        ]);
        let progress: number = 0;
        file
          .on('data', (data: Record<string, any>) => {
            progress = progress + data.length
            InstanceManager.update(instanceKey, 'frontendBytes', progress)
            MessageEmitter.postProgress(instanceKey, 'frontend');
            GoogleDrive.uploadFile(instanceKey, data);
          })
          .on('error', err => {
            logErrorResponse(err, '[END_POINT.UPLOAD_INSTANCE_KEY > BUSBOY]');
          })
      })
      .on('finish', async () => {
        const file: any = await GoogleDrive.endUpload(instanceKey);
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
      logErrorResponse(err, '[END_POINT.UPLOAD_INSTANCE_KEY > UPLOAD]');
    }
});

module.exports = router;
