'use strict';

const { google } = require('googleapis');
import { PassThrough } from 'stream';

import { logSuccessResponse, logErrorResponse } from '../../utils/Logger';
import MessageEmitter from '../../utils/MessageEmitter';
import InstanceManager from '../../utils/InstanceManager';
import { CloudStorageProviderClient, CreatedFileDetails, Platform } from '../../customTypes/3PStorage';
import { IPlatform } from '../Platform';

export class GoogleDrive implements IPlatform {
  public static redirect_uris: string[] = ['urn:ietf:wg:oauth:2.0:oob', 'http://localhost'];
  public static actions: Record<string, string> = { driveFiles: 'https://www.googleapis.com/auth/drive.file' };
  private static className = 'googledrive';

  public constructor() {}
  private oAuth2Client: CloudStorageProviderClient;

  //TOKEN FLOW - INSTANCE MANAGER VARIABLES HERE DO NOT PERSIST TO UPLOAD FLOW
  public static createAuthUrl(credentials: Record<string, string> , instanceKey: string): string {
    let clientId: string, clientSecret: string, redirect_uri: string;
    ({ clientId, clientSecret, redirect_uri } = credentials);

    const oAuth2Client: OAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirect_uri);
    return oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: GoogleDrive.actions.driveFiles,
      state: Buffer.from(instanceKey).toString('base64')
    });
  }

  public static async getTokens(code: string, instanceKey: string, hostName: string): Promise<Record<string, any>> {
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
  static async authorize(instanceKey: string): Promise<CloudStorageProviderClient> {
    try {
      const driveInstance = new GoogleDrive();
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
      const oAuth2Client: OAuth2Client = new google.auth.OAuth2(clientId, clientSecret, GoogleDrive.redirect_uris[0]);
      const tokens: Record<string, string> = {
        access_token: accessToken,
        refresh_token: refreshToken,
        scope: GoogleDrive.actions.driveFiles,
        token_type: 'Bearer',
        expiry_date: expiryDate
      };
      oAuth2Client.setCredentials(tokens);
      driveInstance.oAuth2Client = oAuth2Client;
      logSuccessResponse(instanceKey, '[GOOGLE_DRIVE.AUTHORIZE]');
      return driveInstance;
    } catch (err) {
      logErrorResponse(err, '[GOOGLE_DRIVE.AUTHORIZE]');
      throw(err);
    }
  }

  async initUpload(instanceKey: string, uploadStream: PassThrough, fileDetailsMap: Record<string, FileDetail>, fileDetailKey: string): Promise<any> {
    let destinationFolderId: string, fileName: string, mimeType: string;
    ({ destinationFolderId } = await InstanceManager.get(instanceKey, [ MapKey.destinationFolderId ]));
    ({ fileName, mimeType } = fileDetailsMap[fileDetailKey]);
    const drive = google.drive({ version: 'v3', auth: this.oAuth2Client });
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
        onUploadProgress: (evt: Record<string, any>) => {
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

  async uploadFile(fileDetailsMap: Record<string, FileDetail>, fileDetailKey: string, payload: Record<string, any>): Promise<void> {
    fileDetailsMap[fileDetailKey].uploadStream.push(payload);
  }

  async endUpload(fileDetails: FileDetail): Promise<CreatedFileDetails> {
    const googleFileCreationResult = await fileDetails.file;
    const { name, webViewLink, id, fileExtension, webContentLink } = googleFileCreationResult.data;

    const createdFileDetails = new CreatedFileDetails(
      googleFileCreationResult.status,
      id,
      name,
      webViewLink,
      fileExtension,
      GoogleDrive.className as Platform
      );
      createdFileDetails.webContentLink = webContentLink;
      return createdFileDetails;
  }
}

export default GoogleDrive;
