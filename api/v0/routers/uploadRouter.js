'use strict';

const express = require('express');
const router = express.Router();
const Busboy = require('busboy');

const { logSuccessResponse, logErrorResponse } = require('../lib/Logger.js');
const InstanceManager = require('../lib/InstanceManager.js');
const MessageEmitter = require('../lib/MessageEmitter.js');
const GoogleDrive = require('../lib/GoogleDrive.js');
const JsForce = require('../lib/JsForce.js');

router.post('/token/:instanceKey', async (req, res) => {
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

router.post('/uploadDetails/:instanceKey', async (req, res) => {
  const instanceKey = req.params.instanceKey;
  let revisionId, destinationFolderId, isNew;
  ({ revisionId, destinationFolderId, isNew } = req.body);
  const instanceDetails = { revisionId, destinationFolderId, isNew };
  InstanceManager.add(instanceKey, instanceDetails);
  logSuccessResponse({ instanceKey }, '[END_POINT.UPLOAD_DETAILS]');
  res.status(200).send({ instanceKey });
});

router.post('/:instanceKey', async (req, res) => {
  const instanceKey = req.params.instanceKey;
  const form = new Busboy({ headers: req.headers });
  let salesforceUrl, isNew;
  ({ salesforceUrl, isNew } = InstanceManager.get(instanceKey, ['salesforceUrl', 'isNew']));
  try {
    let fileSize;
    form
      .on('field', (fieldName, value) => {
        fileSize = fieldName == 'fileSize' ? value : 0;
        console.log('fileSize', fileSize);
      })
      .on('file', async function(_1, file, fileName, _2, mimeType ) {
        await Promise.all([
          GoogleDrive.initUpload(instanceKey, { fileName, mimeType, fileSize }),
          InstanceManager.add(instanceKey, {frontendBytes: 0, externalBytes: 0, fileSize })
        ]);
        let progress = 0;
        file
          .on('data', data => {
            progress = progress + data.length
            InstanceManager.update(instanceKey, 'frontendBytes', progress)
            MessageEmitter.postProgress(instanceKey, 'frontend');
            GoogleDrive.uploadFile(instanceKey, data);
          })
          .on('error', error => {
            logErrorResponse(error, '[END_POINT.UPLOAD_INSTANCE_KEY > BUSBOY]');
          })
      })
      .on('finish', async () => {
        const file = await GoogleDrive.endUpload(instanceKey);
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
      });
      req.pipe(form);

      logSuccessResponse(response, '[END_POINT.UPLOAD_INSTANCE_KEY > UPLOAD]');
    } catch (err) {
      logErrorResponse(err, '[END_POINT.UPLOAD_INSTANCE_KEY > UPLOAD]');
    }
});

module.exports = router;
