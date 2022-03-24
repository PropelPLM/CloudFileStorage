'use strict';

const { google } = require('googleapis');
import { PassThrough } from 'stream';

import { logSuccessResponse, logErrorResponse } from '../../utils/Logger';
import MessageEmitter from '../../utils/MessageEmitter';
import InstanceManager from '../../utils/InstanceManager';

class GoogleDrive implements IPlatform {
  public redirect_uris: string[] = ['urn:ietf:wg:oauth:2.0:oob', 'http://localhost'];
  public actions: Record<string, string> = { driveFiles: 'https://www.googleapis.com/auth/drive.file' };

  public constructor() {}

  //TOKEN FLOW - INSTANCE MANAGER VARIABLES HERE DO NOT PERSIST TO UPLOAD FLOW
  public createAuthUrl(credentials: Record<string, string> , instanceKey: string): string {
    let clientId: string, clientSecret: string, redirect_uri: string;
    ({ clientId, clientSecret, redirect_uri } = credentials);

    const oAuth2Client: OAuth2Client  = new google.auth.OAuth2(clientId, clientSecret, redirect_uri);
    InstanceManager.upsert(instanceKey, { oAuth2Client });
    return oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: this.actions.driveFiles,
      state: Buffer.from(instanceKey).toString('base64')
    });
  }

  public getTokens(code: string, instanceKey: string): Record<string, any> {
    let oAuth2Client: OAuth2Client;
    try {
      ({ oAuth2Client } = InstanceManager.get(instanceKey, [MapKey.oAuth2Client]));
      const token = oAuth2Client.getToken(code);
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
      throw (err);
    }
  }

  async initUpload(instanceKey: string, fileDetailKey: string, { fileName, mimeType }: { fileName: string, mimeType: string }): Promise<void> {
    let destinationFolderId: string, oAuth2Client: OAuth2Client, fileDetails: Record<string, FileDetail>;
    ({ destinationFolderId, oAuth2Client, fileDetails } = InstanceManager.get(instanceKey, [MapKey.destinationFolderId, MapKey.oAuth2Client, MapKey.fileDetails]));
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
          let totalFileSize: number, totalExternalBytes: number;
          ({ fileDetails } = InstanceManager.get(instanceKey, [MapKey.fileDetails]));
          fileDetails[fileDetailKey].externalBytes = bytesRead;
          InstanceManager.upsert(instanceKey, { fileDetails }) //REVERT
          MessageEmitter.postProgress(instanceKey, fileDetailKey, 'GOOGLE_DRIVE');
          totalFileSize = totalExternalBytes = 0;
          for (const detail in fileDetails) {
            totalFileSize += fileDetails[detail].fileSize;
            totalExternalBytes += fileDetails[detail].externalBytes;
          }
          if (totalExternalBytes == totalFileSize) {
            logSuccessResponse({fileName}, '[GOOGLE_DRIVE.FILE_UPLOAD_END]');
            //SUPER IMPORTANT - busboy doesnt terminate the stream automatically: file stream to external storage will remain open
            uploadStream.emit('end');
          }
        }
      }
    )
    fileDetails[fileDetailKey].file = file;
    fileDetails[fileDetailKey].uploadStream = uploadStream;
    InstanceManager.upsert(instanceKey, { fileDetails }); //REVERT
  }

  async uploadFile(instanceKey: string, fileDetailKey: string, payload: Record<string, any>): Promise<void> {
    let fileDetails: Record<string, FileDetail>;
    ({ fileDetails } = InstanceManager.get(instanceKey, [MapKey.fileDetails])); //REVERT
    try {
      fileDetails[fileDetailKey].uploadStream.push(payload);
      InstanceManager.upsert(instanceKey, { fileDetails });
    } catch (err) {
      logErrorResponse(err, '[GOOGLE_DRIVE > UPLOAD_FILE]')
    }
  }

  async endUpload(instanceKey: string, fileDetailKey: string): Promise<GoogleFile> {
    try {
      console.log(2)
      let fileDetails: Record<string, FileDetail>;
      ({ fileDetails } = InstanceManager.get(instanceKey, [MapKey.fileDetails]));
      console.log(3)
      return await fileDetails[fileDetailKey].file;
    } catch (err: any) {
      console.log(5)
      console.log(err);
      console.log(6)
      console.log(err.response);
      console.log(7)
      console.log(err.response.data);
      console.log(8)
      throw new Error('client error');
    }
  }
}

export default new GoogleDrive();
