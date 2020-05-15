'use strict';

export {};
const { google } = require('googleapis');
const { PassThrough } = require('stream');

const { logSuccessResponse, logErrorResponse } = require('./Logger');
const MessageEmitter = require('./MessageEmitter');
const InstanceManager = require('./InstanceManager');
const JsForce = require('./JsForce');

const redirect_uris = ['urn:ietf:wg:oauth:2.0:oob', 'http://localhost'];
const actions = { driveFiles: 'https://www.googleapis.com/auth/drive.file' };

//TOKEN FLOW - INSTANCE MANAGER VARIABLES HERE DO NOT PERSIST TO UPLOAD FLOW
function createAuthUrl(credentials: Record<string, string> , instanceKey: string): string {
  let clientId: string, clientSecret: string, redirect_uri: string;
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

async function getTokens(code: string, instanceKey: string) {
  let clientId: string, clientSecret: string, oAuth2Client: any;
  ({ clientId, clientSecret, oAuth2Client } = InstanceManager.get(instanceKey, ['clientId', 'clientSecret', 'oAuth2Client']));

  oAuth2Client.getToken(code, (err: any, token: Record<string, string>) => {
      JsForce.sendTokens({ ...token, clientId, clientSecret }, instanceKey);
  });
  logSuccessResponse({}, '[GOOGLE_DRIVE.GET_TOKENS]');
  MessageEmitter.postTrigger(instanceKey, 'authComplete', {});
}

//UPLOAD FLOW- INSTANCE MANAGER VARIABLES HERE DFO NOT PERSIST FROM TOKEN FLOW
async function authorize(instanceKey: string, clientId: string, clientSecret: string, tokens: Record<string, string>) {//}, options, callback) {
  try {
    const oAuth2Client: any = new google.auth.OAuth2(clientId, clientSecret, redirect_uris[0]);
    oAuth2Client.setCredentials(tokens);
    InstanceManager.add(instanceKey, { oAuth2Client });
    logSuccessResponse({}, '[GOOGLE_DRIVE.AUTHORIZE]');
  } catch (err) {
    logErrorResponse(err, '[GOOGLE_DRIVE.AUTHORIZE]');
  }
}

async function initUpload(instanceKey: string, { fileName, mimeType, fileSize }: { fileName: string, mimeType: string, fileSize: number }) {
  let destinationFolderId: string, oAuth2Client: any;
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
      onUploadProgress: (evt: Record<string, any>) => {
        const bytesRead: number = evt.bytesRead;
        InstanceManager.update(instanceKey, 'externalBytes', bytesRead)
        MessageEmitter.postProgress(instanceKey, 'Google Drive');
        if (bytesRead == fileSize) {
          //SUPER IMPORTANT - busboy doesnt terminate the stream automatically: file stream to external storage will remain open
          uploadStream.emit('end');
        }
      }
    }
  )
  InstanceManager.addRef(instanceKey, 'uploadStream', uploadStream);
  InstanceManager.addRef(instanceKey, 'file', file);
}

async function uploadFile(instanceKey: string, payload: Record<string, any>) {
  let uploadStream;
  ({ uploadStream } = InstanceManager.getRef(instanceKey, 'uploadStream'));
  uploadStream.write(payload)
  InstanceManager.update(instanceKey, 'uploadStream', uploadStream);
}

async function endUpload(instanceKey: string) {
  let file: Object;
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
