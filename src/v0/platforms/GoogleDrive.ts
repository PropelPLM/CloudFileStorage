'use strict';

const { google } = require('googleapis');
import { PassThrough } from 'stream';

import { logSuccessResponse, logErrorResponse } from '../utils/Logger';
import MessageEmitter from '../utils/MessageEmitter';
import InstanceManager from '../utils/InstanceManager';

class GoogleDrive implements IPlatform {
  public redirect_uris: string[] = ['urn:ietf:wg:oauth:2.0:oob', 'http://localhost'];
  public actions: Record<string, string> = { driveFiles: 'https://www.googleapis.com/auth/drive.file' };

  public constructor() {}
  
  //TOKEN FLOW - INSTANCE MANAGER VARIABLES HERE DO NOT PERSIST TO UPLOAD FLOW
  public createAuthUrl(credentials: Record<string, string> , instanceKey: string): string {
    let clientId: string, clientSecret: string, redirect_uri: string;
    ({ clientId, clientSecret, redirect_uri } = credentials);

    const oAuth2Client: OAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirect_uri);
    InstanceManager.upsert(instanceKey, { oAuth2Client });
    return oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: this.actions.driveFiles,
      state: Buffer.from(instanceKey).toString('base64')
    });
  }

  public async getTokens(code: string, instanceKey: string): Promise<Record<string, any>> {
    let oAuth2Client: OAuth2Client;
    ({ oAuth2Client } = InstanceManager.get(instanceKey, [MapKey.oAuth2Client]));
    try {
      const token = await oAuth2Client.getToken(code);
      logSuccessResponse({}, '[GOOGLE_DRIVE.GET_TOKENS]');
      return token;
    } catch (err) {
      logErrorResponse(err, '[GOOGLE_DRIVE.GET_TOKENS]');
      return {};
    }
  }

  //UPLOAD FLOW- INSTANCE MANAGER VARIABLES HERE DFO NOT PERSIST FROM TOKEN FLOW
  public async authorize(instanceKey: string, clientId: string, clientSecret: string, tokens: Record<string, string>): Promise<void> {
    try {
      const oAuth2Client: OAuth2Client = new google.auth.OAuth2(clientId, clientSecret, this.redirect_uris[0]);
      oAuth2Client.setCredentials(tokens);
      InstanceManager.upsert(instanceKey, { oAuth2Client });
      logSuccessResponse({}, '[GOOGLE_DRIVE.AUTHORIZE]');
    } catch (err) {
      logErrorResponse(err, '[GOOGLE_DRIVE.AUTHORIZE]');
    }
  }

  async initUpload(instanceKey: string, { fileName, mimeType, fileSize }: { fileName: string, mimeType: string, fileSize: number }): Promise<void> {
    let destinationFolderId: string, oAuth2Client: OAuth2Client;
    ({ destinationFolderId, oAuth2Client } = InstanceManager.get(instanceKey, [MapKey.destinationFolderId, MapKey.oAuth2Client]));
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
          InstanceManager.upsert(instanceKey, { externalBytes: bytesRead }) //REVERT
          MessageEmitter.postProgress(instanceKey, 'GOOGLE_DRIVE');
          if (bytesRead == fileSize) {
            //SUPER IMPORTANT - busboy doesnt terminate the stream automatically: file stream to external storage will remain open
            uploadStream.emit('end');
          }
        }
      }
    )
    InstanceManager.upsert(instanceKey, { uploadStream, file }); //REVERT
  }

  async uploadFile(instanceKey: string, payload: Record<string, any>): Promise<void> {
    let uploadStream;
    ({ uploadStream } = InstanceManager.get(instanceKey, [MapKey.uploadStream])); //REVERT
    try {
      uploadStream.push(payload)
      InstanceManager.upsert(instanceKey, { uploadStream });
    } catch (err) {
      logErrorResponse(err, '[GOOGLE_DRIVE > UPLOAD_FILE]')
    }
  }

  async endUpload(instanceKey: string): Promise<GoogleFile> {
    let file: GoogleFile;
    ({ file } = InstanceManager.get(instanceKey, [MapKey.file]));
    return await file;
  }
}

export default new GoogleDrive();
