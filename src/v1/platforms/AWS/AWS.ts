'use strict';

import aws from 'aws-sdk';
import { IPlatform } from '../Platform'
import { PassThrough } from 'stream';

import { logSuccessResponse, logErrorResponse } from '../../utils/Logger';
import MessageEmitter from '../../utils/MessageEmitter';
import InstanceManager from '../../utils/InstanceManager';
import { CloudStorageProviderClient } from '../../customTypes/GoogleObjects';

class AWS implements IPlatform {
  private S3Client: CloudStorageProviderClient;
  public constructor() {}

  private async createBucket(salesforceUrl: string) {
    try {
      await this.S3Client.createBucket({ Bucket: salesforceUrl }).promise();
      return true;
    } catch (error: any) {
      logErrorResponse(error.stack, '[AWS.CREATE_BUCKET]');
      return false;
    }
  }

  private async bucketExists(bucket: string) {
    try {
      await this.S3Client.headBucket({ Bucket: bucket }).promise();
      return true;
    } catch (error: any) {
      if (error.statusCode === 403) {
        logErrorResponse('Forbidden (most likely due to permissions)', '[AWS.CHECK_BUCKET]');
        return false;
      } else {
        throw new Error(error.statusCode === 404 ?
          'No such bucket exists' :
          error.stack
        );
      }
    }
  };

  public async authorize(instanceKey: string): Promise<CloudStorageProviderClient> {
    try {
      if (!this.S3Client) {
        this.S3Client = new aws.S3();
        logSuccessResponse(instanceKey, '[AWS.AUTHORIZE]');
      }
      return this.S3Client;
    } catch (err) {
      logErrorResponse(err, '[AWS.AUTHORIZE]');
      throw(err);
    }
  }

  async initUpload(instanceKey: string, oAuth2Client: CloudStorageProviderClient, uploadStream: PassThrough, fileDetailsMap: Record<string, FileDetail>, fileDetailKey: string): Promise<any> {
    let destinationFolderId: string, fileName: string, mimeType: string, salesforceUrl: string;
    ({ destinationFolderId, salesforceUrl } = await InstanceManager.get(instanceKey, [ MapKey.destinationFolderId, MapKey.salesforceUrl ]));
    ({ fileName, mimeType } = fileDetailsMap[fileDetailKey]);
    if (! await this.bucketExists(salesforceUrl)) {
      await this.createBucket(salesforceUrl);
    }
    const params = {
      Bucket: salesforceUrl,
      Key: `${destinationFolderId}${fileName}`,
      Body: uploadStream,
      ContentType: mimeType,
      ACL: 'public-read'
    };
    return oAuth2Client
      .upload(params)
      .on('httpUploadProgress', (evt: Record<string, any>) => {
        const bytesRead: number = evt.loaded;
        let totalFileSize: number, totalExternalBytes: number;
        fileDetailsMap[fileDetailKey].externalBytes = bytesRead;
        MessageEmitter.postProgress(instanceKey, fileDetailsMap, fileDetailKey, 'AWS');
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
      })
      .promise();
  }

  async uploadFile(fileDetails: FileDetail, payload: Record<string, any>): Promise<void> {
    try {
      fileDetails.uploadStream.push(payload);
    } catch (err) {
      logErrorResponse(err, '[AWS > UPLOAD_FILE]')
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

export default new AWS();
