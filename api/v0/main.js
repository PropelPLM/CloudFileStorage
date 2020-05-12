'use strict';

const cors = require('cors');
const express = require('express');
const Busboy = require('busboy');
const path = require('path');

const app = express();
const server = require('http').createServer(app);
module.exports = server;
const port = process.env.PORT || 5000;

const { logSuccessResponse, logErrorResponse } = require('./Logger.js');
const InstanceManager = require('./InstanceManager.js');
const MessageEmitter = require('./MessageEmitter.js');
const GoogleDrive = require('./lib/GoogleDrive.js');
const JsForce = require('./lib/JsForce.js');

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, '../../public')));

app.get('/:instanceKey', (req, res) => {
  const instanceKey = req.params.instanceKey;
  logSuccessResponse(instanceKey, '[END_POINT.INSTANCE_KEY]');
  res.sendFile('index.html', { root: path.join(__dirname, '../../public/') });
});

app.post('/auth/:instanceKey', async (req, res) => {
  const instanceKey = req.params.instanceKey;
  let sessionId, salesforceUrl, clientId, clientSecret;
  ({ sessionId, salesforceUrl, clientId, clientSecret } = req.body);

  InstanceManager.register(instanceKey);
  const instanceDetails = { salesforceUrl, clientId, clientSecret };
  await Promise.all([
    InstanceManager.add(instanceKey, instanceDetails),
    JsForce.connect(sessionId, salesforceUrl, instanceKey)
  ]);

  if (clientId && clientSecret) {
    const credentials = { clientId, clientSecret, redirect_uri: `https://${req.hostname}/auth/callback/google` }; //google can be swapped out
    const url = GoogleDrive.createAuthUrl(credentials, instanceKey);

    MessageEmitter.setAttribute(instanceKey, 'target-window', salesforceUrl);
    logSuccessResponse(instanceKey, '[END_POINT.AUTH_REDIRECT]');
    res.status(200).send({ url });
  } else {
    logErrorResponse({ clientId, clientSecret }, '[END_POINT.AUTH_REDIRECT]');
    res.status(400).send('Authorization failed, please ensure client credentials are populated.');
  }
});

app.get('/auth/callback/google', async (req, res) => {
  const instanceKey = Buffer.from(req.query.state, 'base64').toString();
  const code = req.query.code;
  await GoogleDrive.getTokens(code, instanceKey);
  res.send('<script>window.close()</script>');
});

app.post('/token/:instanceKey', async (req, res) => {
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

app.post('/uploadDetails/:instanceKey', async (req, res) => {
  const instanceKey = req.params.instanceKey;
  let revisionId, destinationFolderId, isNew;
  ({ revisionId, destinationFolderId, isNew } = req.body);
  const instanceDetails = { revisionId, destinationFolderId, isNew };
  InstanceManager.add(instanceKey, instanceDetails);
  logSuccessResponse({ instanceKey }, '[END_POINT.UPLOAD_DETAILS]');
  res.status(200).send({ instanceKey });
});

app.post('/upload/:instanceKey', async (req, res) => {
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
      })
    req.pipe(form);

    logSuccessResponse(response, '[END_POINT.UPLOAD_INSTANCE_KEY > UPLOAD]');
  } catch (err) {
    logErrorResponse(err, '[END_POINT.UPLOAD_INSTANCE_KEY > UPLOAD]');
  }
});

server.listen(port, () => {
  logSuccessResponse('SUCCESS', '[SERVER_RUNNING]');
});
