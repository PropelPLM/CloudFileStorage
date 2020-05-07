'use strict';
const { google } = require('googleapis');
const cors = require('cors');
const express = require('express');
const formidable = require('formidable');
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
    InstanceManager.add(instanceKey, instanceDetails);

    await JsForce.connect(sessionId, salesforceUrl, instanceKey);
    logSuccessResponse(tokensFromCredentials, '[END_POINT.TOKEN]');
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
  console.log(0);
  const form = new formidable.IncomingForm();
  console.log(1);

  let destinationFolderId, salesforceUrl, isNew, oAuth2Client;
  ({ destinationFolderId, salesforceUrl, isNew, oAuth2Client } = InstanceManager.get(instanceKey, ['destinationFolderId', 'salesforceUrl', 'isNew', 'oAuth2Client']));
  const drive = google.drive({ version: 'v3', auth: oAuth2Client });
  console.log(2);
  var totalBytes;
  form.on('progress', (bytesReceived, bytesExpected) => {
    console.log(3);
    totalBytes = bytesExpected*2;
    console.log('bytesExpected', bytesExpected);
    console.log('onprogress', parseInt( 100 * bytesReceived / bytesExpected ), '%');
  })
  form.on('end', () => {
    console.log(done);
    console.log('onprogress', parseInt( 100 * bytesReceived / bytesExpected ), '%');
  })
  form.onPart = part => {
    console.log(4);
    console.log('part', part);
    var fileMetadata = {
      name: part.name,
      driveId: destinationFolderId,
      parents: [destinationFolderId]
    };
    let fileStream = new Transform({
      transform(chunk, encoding, callback) {
        this.push(chunk);
        callback();
      }
    });
    var media = {
      mimeType: part.mime,
      body: fileStream
    };
    const file = drive.files.create(
      {
        resource: fileMetadata,
        media,
        supportsAllDrives: true,
        fields: 'id, name, webViewLink, mimeType, fileExtension, webContentLink'
      },
      {
        onUploadProgress: evt => {
          console.log('g progress', (evt.bytesRead/totalBytes) * 100)
        }
      }
    );
    part.on('data', data => {
      data.pipe(media);
    })
  }
  form.parse(req, (err, fields, files)=> {
    console.log(5)
    console.log('fields', fields);
    console.log('files', files);
    console.log(err);
  })
  // var fileName;
  // var mimeType;
  // var storage = multer.diskStorage({
  //   destination: function (req, file, cb) {
  //     cb(null, './');
  //   },
  //   filename: function (req, file, cb) {
  //     fileName = file.originalname || file.name;
  //     mimeType = file.mimetype;
  //     cb(null, fileName);
  //   }
  // });
  // var upload = util.promisify(multer({ storage: storage }).single('file'));
  // try {
  //   await upload(req, res);
  // } catch (err) {
  //   logErrorResponse(err, '[END_POINT.UPLOAD_INSTANCE_KEY > LOCAL_UPLOAD]');
  // }
  try {
    // const options = { fileName, mimeType };
    // console.log(8);
    // const response = await GoogleDrive.uploadFile(options, instanceKey);
    // console.log(9);

    // res.status(response.status).send(response.data);
    res.writeHead(200);
    res.write('received upload: \n\n');
    logSuccessResponse(response, '[END_POINT.UPLOAD_INSTANCE_KEY > UPLOAD]');
  } catch (err) {
    logErrorResponse(err, '[END_POINT.UPLOAD_INSTANCE_KEY > UPLOAD]');
    res.status(503).send(`Drive upload failed: ${err}`);
  }
});

server.listen(port, () => {
  logSuccessResponse('SUCCESS', '[SERVER_RUNNING]');
});
