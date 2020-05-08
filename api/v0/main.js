'use strict';
const { google } = require('googleapis');
const { PassThrough } = require('stream');
const cors = require('cors');
const express = require('express');
const Busboy = require('busboy');
// const multer = require('multer');
const path = require('path');
// const util = require('util');

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

app.get('/setAttribute/:instanceKey', (req, res) => {
  const instanceKey = req.params.instanceKey;
  logSuccessResponse(instanceKey, '[END_POINT.SET_ATTRIBUTE]');
  res.send('OK');
  let salesforceUrl;
  ({ salesforceUrl } = InstanceManager.get(instanceKey, ['salesforceUrl']));
  MessageEmitter.setAttribute(instanceKey, 'target-window', salesforceUrl);
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

//migrate this over
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
  console.log(1);
  // const form = new formidable.IncomingForm();
  const form = new Busboy({ headers: req.headers });
  console.log(2);
  let salesforceUrl, isNew;
  ({ salesforceUrl, isNew } = InstanceManager.get(instanceKey, ['salesforceUrl', 'isNew']));
  console.log(3);
  try {
    // form
    //   .on('progress', (bytesReceived, bytesExpected) => {
    //     MessageEmitter.postProgress(instanceKey, 'FRONT_END', bytesReceived, bytesExpected);
    //   })
    //   .on('end', async() => {
    //     console.log('[FRONTEND_UPLOAD_COMPLETE]');
    //   })
    //   .on('error', err => {
    //     console.log('[FRONTEND_UPLOAD_ERROR]', err)
    //   })
    // form.onPart = async part => {
    //   part
    //   .on('fileBegin', (name, file) => {
    //       console.log(4);
    //       console.log('fileBegin name', name)
    //       console.log('fileBegin file', file)
    //     })
    //     .on('field', (name, file) => {
    //       console.log(5);
    //       console.log('field name', name)
    //       console.log('field file', file)
    //     })
    //     .on('file', (name, file) => {
    //       console.log(6);
    //       console.log('file name', name)
    //       console.log('file file', file)
    //     })
    //     .on('progress', (bytesReceived, bytesExpected) => {
    //       console.log(7);
    //       MessageEmitter.postProgress(instanceKey, 'FRONT_END', bytesReceived, bytesExpected);
    //     })
    //     .on('data', async part => {
    //       console.log(8);
    //       console.log('part', part)
    //       await GoogleDrive.initUpload(instanceKey, part.filename, part.mime);
    //       console.log(5.3);
    //       GoogleDrive.uploadFile(instanceKey, part);
    //     })
    //   }
    const initConf = {}
    form
      .on('field', (fieldName, value, _, _, _, _) => {
        initConf[fieldName] = value;
      })
      .on('file', async function(_, file, fileName, _, mimeType ) {
        await Promise.all([
          GoogleDrive.initUpload(instanceKey, { fileName, mimeType, ...initConf}),
          InstanceManager.add(instanceKey, {...initConf, progress: 0})
        ])
        const progress = 0;
        file.on('data', data => {
          progress = progress + data.length
          MessageEmitter.postProgress(instanceKey, 'FRONT_END', progress, initConf[size]);
          GoogleDrive.uploadFile(instanceKey, data);
        })
      })
    req.pipe(form);
    console.log(9);
    // form.parse(req, async (err, fields, files)=> {
    //   console.log(10);
    //   const file = await GoogleDrive.endUpload(instanceKey);
    //   console.log(11);
    //   const sfObject = await JsForce.create(file.data, instanceKey);
    //   console.log(12);
    //   const response = {
    //     status: parseInt(file.status),
    //     data: {
    //       ...file.data,
    //       sfId: sfObject.id,
    //       revisionId: sfObject.revisionId,
    //       salesforceUrl,
    //       isNew
    //     }
    //   }
    //   console.log(13);
    //   res.status(response.status).send(response.data);
    // })
    // const options = { fileName, mimeType };
    // console.log(8);
    // const response = await GoogleDrive.uploadFile(options, instanceKey);
    // console.log(9);

    
    // res.writeHead(200);
    // res.write('received upload: \n\n');
    logSuccessResponse(response, '[END_POINT.UPLOAD_INSTANCE_KEY > UPLOAD]');
  } catch (err) {
    logErrorResponse(err, '[END_POINT.UPLOAD_INSTANCE_KEY > UPLOAD]');
    // res.writeHead(503);
    // res.write(`Drive upload failed: ${err}`);
  }
});

server.listen(port, () => {
  logSuccessResponse('SUCCESS', '[SERVER_RUNNING]');
});
