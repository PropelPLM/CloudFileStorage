'use strict';

import aws from 'aws-sdk';
import { IPlatform } from '../Platform'
import { PassThrough } from 'stream';

import { logSuccessResponse, logErrorResponse } from '../../utils/Logger';
import MessageEmitter from '../../utils/MessageEmitter';
import InstanceManager from '../../utils/InstanceManager';
import { CloudStorageProviderClient } from '../../customTypes/GoogleObjects';

export class AWS implements IPlatform {
  private S3Client: CloudStorageProviderClient;
  public constructor() {}

  static async authorize(instanceKey: string): Promise<CloudStorageProviderClient> {
    try {
      const awsInstance = new AWS();
      awsInstance.S3Client = new aws.S3();
      logSuccessResponse(instanceKey, '[AWS.AUTHORIZE]');
      return awsInstance;
    } catch (err) {
      logErrorResponse(err, '[AWS.AUTHORIZE]');
      throw(err);
    }
  }

  private async createBucket(bucketName: string) {
    try {
      await this.S3Client.createBucket({ Bucket: bucketName }).promise();
      return true;
    } catch (error: any) {
      logErrorResponse(error.stack, '[AWS.CREATE_BUCKET]');
      return false;
    }
  }

  private async bucketExists(bucketName: string) {
    try {
      await this.S3Client.headBucket({ Bucket: bucketName }).promise();
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

  async initUpload(instanceKey: string, uploadStream: PassThrough, fileDetailsMap: Record<string, FileDetail>, fileDetailKey: string): Promise<any> {
    let destinationFolderId: string, fileName: string, mimeType: string, salesforceUrl: string;
    ({ destinationFolderId, salesforceUrl } = await InstanceManager.get(instanceKey, [ MapKey.destinationFolderId, MapKey.salesforceUrl ]));
    ({ fileName, mimeType } = fileDetailsMap[fileDetailKey]);

    const sanitisedName = AWS.sanitiseBucketName(salesforceUrl);
    if (! await this.bucketExists(sanitisedName)) {
      await this.createBucket(sanitisedName);
    }
    const params = {
      Bucket: sanitisedName,
      Key: `${destinationFolderId}/${fileName}`,
      Body: uploadStream,
      ContentType: mimeType,
      ACL: 'public-read'
    };
    return this.S3Client
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
          logSuccessResponse({fileName}, '[AWS.FILE_UPLOAD_END]');
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
      ({ error, error_description } = err.response.data);
      throw new Error(`${error}: ${error_description}`);
    }
  }

  private static sanitiseBucketName(bucketName: string): string {
    return bucketName.replace(/((^\w+:|^)\/\/)|\/|:/g, '');
  }
}

