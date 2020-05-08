const { google } = require('googleapis');
const { PassThrough } = require('stream');
const fs = require('fs');
const progress = require('progress-stream');

const { logSuccessResponse, logErrorResponse } = require('../Logger.js');
const MessageEmitter = require('../MessageEmitter.js');
const InstanceManager = require('../InstanceManager.js');
const JsForce = require('./JsForce.js');

const redirect_uris = ['urn:ietf:wg:oauth:2.0:oob', 'http://localhost'];
const actions = {
  driveFiles: 'https://www.googleapis.com/auth/drive.file'
};

//TOKEN FLOW - INSTANCE MANAGER VARIABLES HERE DO NOT PERSIST TO UPLOAD FLOW
function createAuthUrl(credentials, instanceKey) {
  let clientId, clientSecret, redirect_uri;
  ({ clientId, clientSecret, redirect_uri } = credentials);

  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirect_uri);
  InstanceManager.add(instanceKey, { oAuth2Client });
  return oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: actions.driveFiles,
    state: Buffer.from(instanceKey).toString('base64')
  });
}

async function getTokens(code, instanceKey) {
  let clientId, clientSecret, oAuth2Client;
  ({ clientId, clientSecret, oAuth2Client } = InstanceManager.get(instanceKey, ['clientId', 'clientSecret', 'oAuth2Client']));

  oAuth2Client.getToken(code, (err, token) => {
    JsForce.sendTokens({ ...token, clientId, clientSecret }, instanceKey);
  });
  logSuccessResponse({}, '[GOOGLE_DRIVE.GET_TOKENS]');
  MessageEmitter.postTrigger(instanceKey, 'authComplete', {});
}

//UPLOAD FLOW- INSTANCE MANAGER VARIABLES HERE DFO NOT PERSIST FROM TOKEN FLOW
/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {String} clientId Client ID from Google API console
 * @param {String} clientSecret Client Secret from Google API console
 * @param {Object} tokens Acces and Refresh tokens and their expiry
 * @param {Object} options Specifies how the operation in the callback should be
 *                 executed in the external file storage
 * @param {function} callback The callback to call with the authorized client.
 */
async function authorize(instanceKey, clientId, clientSecret, tokens) {//}, options, callback) {
  try {
    const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirect_uris[0]);
    oAuth2Client.setCredentials(tokens);
    InstanceManager.add(instanceKey, { oAuth2Client });
    logSuccessResponse({}, '[GOOGLE_DRIVE.AUTHORIZE]');
  } catch (err) {
    logErrorResponse(err, '[GOOGLE_DRIVE.AUTHORIZE]');
  }
  // return await callback(oAuth2Client, options);
}

/**
 * Uploads file with an OAuth2 client and then execute communicate the metadata of
 * the record in the external file storage back to salesforce APEX.
 * @param {Object} options Specifies how the file should be created in the external file storage
 * @param {String} instanceKey Specifies the session metadata details should be extracted from
 */
// async function uploadFile(options, instanceKey) {
//   let destinationFolderId, salesforceUrl, isNew, oAuth2Client;
//   ({ destinationFolderId, salesforceUrl, isNew, oAuth2Client } = InstanceManager.get(instanceKey, ['destinationFolderId', 'salesforceUrl', 'isNew', 'oAuth2Client']));
//   var fileMetadata = {
//     name: options.fileName,
//     driveId: destinationFolderId,
//     parents: [destinationFolderId]
//   };
//   try {
//     const drive = google.drive({ version: 'v3', auth: oAuth2Client });
//     var stat = fs.statSync(`./${options.fileName}`);
//     var str = progress({ length: stat.size, time: 20 });
//     str.on('progress', (p) => {
//       MessageEmitter.postProgress(instanceKey, p);
//     });
//     let fileStream = new Transform({
//       transform(chunk, encoding, callback) {
//         this.push(chunk);
//         callback();
//       }
//     });
//     fs.createReadStream(`./${options.fileName}`).pipe(str).pipe(fileStream);
//     var media = {
//       mimeType: options.mimeType,
//       body: fileStream
//     };
//     const file = await drive.files.create({
//       resource: fileMetadata,
//       media,
//       supportsAllDrives: true,
//       fields: 'id, name, webViewLink, mimeType, fileExtension, webContentLink'
//     });
//     const sfObject = await JsForce.create(file.data, instanceKey);
//     const response = {
//       status: parseInt(file.status),
//       data: {
//         ...file.data,
//         sfId: sfObject.id,
//         revisionId: sfObject.revisionId,
//         salesforceUrl,
//         isNew
//       }
//     };
//     logSuccessResponse(response, '[GOOGLE_DRIVE.UPLOAD_FILE]');
//     return response;
//   } catch (err) {
//     return logErrorResponse(err, '[GOOGLE_DRIVE.UPLOAD_FILE]');
//   }
// }
// var stack = {};
async function initUpload(instanceKey, fileName, mimeType, size) {
  let destinationFolderId, oAuth2Client;
  ({ destinationFolderId, oAuth2Client } = InstanceManager.get(instanceKey, ['destinationFolderId', 'oAuth2Client']));
  const drive = google.drive({ version: 'v3', auth: oAuth2Client });
  const uploadStream = new PassThrough();
  const fileMetadata = {
    name: fileName,
    driveId: destinationFolderId,
    parents: [destinationFolderId]
  };
  var media = {
    mimeType: mimeType,
    body: uploadStream
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
        MessageEmitter.postProgress(instanceKey, 'GOOGLE_DRIVE', evt.bytesReceived, size);
      }
    }
  )
  InstanceManager.addRef(instanceKey, 'uploadStream', uploadStream);
  InstanceManager.addRef(instanceKey, 'file', file);
}

async function uploadFile(instanceKey, payload) {
  let uploadStream;
  ({ uploadStream } = InstanceManager.getRef(instanceKey, 'uploadStream'));
  payload.pipe(uploadStream);
  InstanceManager.update(instanceKey, 'uploadStream', uploadStream);
}

async function endUpload(instanceKey) {
  let file;
  ({ file } = InstanceManager.getRef(instanceKey, 'file'));
  return await file;
}

module.exports = {
  actions,
  authorize,
  createAuthUrl,
  endUpload,
  getTokens,
  initUpload,
  uploadFile
};
