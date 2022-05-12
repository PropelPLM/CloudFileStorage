'use strict';

const { google } = require('googleapis');
import { PassThrough } from 'stream';

import { logSuccessResponse, logErrorResponse } from '../../utils/Logger';
import MessageEmitter from '../../utils/MessageEmitter';
import InstanceManager from '../../utils/InstanceManager';
import { CloudStorageProviderClient } from '../../customTypes/GoogleObjects';
import { IPlatform } from '../Platform';

class GoogleDrive implements IPlatform {
  public redirect_uris: string[] = ['urn:ietf:wg:oauth:2.0:oob', 'http://localhost'];
  public actions: Record<string, string> = { driveFiles: 'https://www.googleapis.com/auth/drive.file' };

  public constructor() {}

  //TOKEN FLOW - INSTANCE MANAGER VARIABLES HERE DO NOT PERSIST TO UPLOAD FLOW
  public createAuthUrl(credentials: Record<string, string> , instanceKey: string): string {
    let clientId: string, clientSecret: string, redirect_uri: string;
    ({ clientId, clientSecret, redirect_uri } = credentials);

    const oAuth2Client: OAuth2Client  = new google.auth.OAuth2(clientId, clientSecret, redirect_uri);
    return oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: this.actions.driveFiles,
      state: Buffer.from(instanceKey).toString('base64')
    });
  }

  public async getTokens(code: string, instanceKey: string, hostName: string): Promise<Record<string, any>> {
    try {
      let clientId: string, clientSecret: string;
      ({ clientId, clientSecret } = await InstanceManager.get(instanceKey, [ MapKey.clientId, MapKey.clientSecret ]));
      const oAuth2Client: OAuth2Client  = new google.auth.OAuth2(clientId, clientSecret, `https://${hostName}/auth/callback/google`);
      const token = oAuth2Client.getToken(code);
      logSuccessResponse({}, '[GOOGLE_DRIVE.GET_TOKENS]');
      return token;
    } catch (err) {
      logErrorResponse(err, '[GOOGLE_DRIVE.GET_TOKENS]');
      return {};
    }
  }

  //UPLOAD FLOW- INSTANCE MANAGER VARIABLES HERE DFO NOT PERSIST FROM TOKEN FLOW
  public async authorize(instanceKey: string): Promise<CloudStorageProviderClient> {
    try {
      console.log('in auth#$%^&*')
      let clientId, clientSecret, accessToken, refreshToken, expiryDate;
      ({ clientId, clientSecret, accessToken, refreshToken, expiryDate } = await InstanceManager.get(instanceKey,
        [
          MapKey.clientId,
          MapKey.clientSecret,
          MapKey.accessToken,
          MapKey.refreshToken,
          MapKey.expiryDate
        ]
      ));
      console.log({ clientId, clientSecret, accessToken, refreshToken, expiryDate })
      const oAuth2Client: OAuth2Client = new google.auth.OAuth2(clientId, clientSecret, this.redirect_uris[0]);
      const tokens: Record<string, string> = {
        accessToken,
        refreshToken,
        expiryDate,
        scope: this.actions.driveFiles,
        token_type: 'Bearer',
      };
      console.log('tokens')
      console.log(tokens)
      oAuth2Client.setCredentials(tokens);
      logSuccessResponse({}, '[GOOGLE_DRIVE.AUTHORIZE]');
      return oAuth2Client;
    } catch (err) {
      logErrorResponse(err, '[GOOGLE_DRIVE.AUTHORIZE]');
      throw(err);
    }
  }

  async initUpload(instanceKey: string, oAuth2Client: CloudStorageProviderClient, uploadStream: PassThrough, fileDetailsMap: Record<string, FileDetail>, fileDetailKey: string): Promise<any> {
    let destinationFolderId: string, fileName: string, mimeType: string;
    console.log('oAuth2Client')
    console.log(oAuth2Client)
    ({ destinationFolderId } = await InstanceManager.get(instanceKey, [ MapKey.destinationFolderId ]));
    ({ fileName, mimeType } = fileDetailsMap[fileDetailKey]);
    const drive = google.drive({ version: 'v3', auth: oAuth2Client });
    const fileMetadata = {
      name: fileName,
      driveId: destinationFolderId,
      parents: [destinationFolderId]
    };
    var media = {
      mimeType: mimeType,
      body: uploadStream
    };
    return drive.files.create(
      {
        resource: fileMetadata,
        media,
        supportsAllDrives: true,
        fields: 'id, name, webViewLink, mimeType, fileExtension, webContentLink'
      },
      {
        onUploadProgress: async (evt: Record<string, any>) => {
          const bytesRead: number = evt.bytesRead;
          let totalFileSize: number, totalExternalBytes: number;
          fileDetailsMap[fileDetailKey].externalBytes = bytesRead;
          MessageEmitter.postProgress(instanceKey, fileDetailsMap, fileDetailKey, 'GOOGLE_DRIVE');
          totalFileSize = totalExternalBytes = 0;
          for (const detail in fileDetailsMap) {
            totalFileSize += fileDetailsMap[detail].fileSize;
            totalExternalBytes += fileDetailsMap[detail].externalBytes;
          }
          if (totalExternalBytes == totalFileSize) {
            logSuccessResponse({fileName}, '[GOOGLE_DRIVE.FILE_UPLOAD_END]');
            //SUPER IMPORTANT - busboy doesnt terminate the stream automatically: file stream to external storage will remain open
            uploadStream.emit('end');
          }
        }
      }
    );
  }

  async uploadFile(fileDetails: FileDetail, payload: Record<string, any>): Promise<void> {
    try {
      fileDetails.uploadStream.push(payload);
    } catch (err) {
      logErrorResponse(err, '[GOOGLE_DRIVE > UPLOAD_FILE]')
    }
  }

  async endUpload(fileDetails: FileDetail): Promise<GoogleFile> {
    try {
      return await fileDetails.file;
    } catch (err: any) {
      let error: string, error_description: string;
      ({ error, error_description } =err.response.data);
      throw new Error(`${error}: ${error_description}`);
    }
  }
}

export default new GoogleDrive();
