'use strict';

import { CompleteMultipartUploadCommandOutput, HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { PassThrough } from 'stream';

import { logSuccessResponse, logErrorResponse } from '../../utils/Logger';
import MessageEmitter from '../../utils/MessageEmitter';
import InstanceManager from '../../utils/InstanceManager';
import { IPlatform } from '../Platform'

export class AWS implements IPlatform {
  private s3Client: CloudStorageProviderClient;
  private bytesRead = 0;
  private static className: string = 'aws';

  public constructor(public instanceKey: string) {}

  static async authorize(instanceKey: string): Promise<CloudStorageProviderClient> {
    try {
      const awsInstance = new AWS(instanceKey);
      awsInstance.s3Client = new S3Client({region: 'us-east-1'});
      logSuccessResponse(instanceKey, '[AWS.AUTHORIZE]');
      return awsInstance;
    } catch (err) {
      logErrorResponse(err, '[AWS.AUTHORIZE]');
      throw(err);
    }
  }

  private async createBucket(bucketName: string) {
    try {
      await this.s3Client.createBucket({ Bucket: bucketName }).promise();
      return true;
    } catch (error: any) {
      logErrorResponse(error.stack, '[AWS.CREATE_BUCKET]');
      return false;
    }
  }

  private async bucketExists(bucketName: string) {
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
      return true;
    } catch (error: any) {
      if (error.statusCode === 404) {
        logErrorResponse('No such bucket exists', '[AWS.CHECK_BUCKET]');
        return false;
      } else {
        throw new Error(error.statusCode === 403 ?
          'Forbidden (most likely due to permissions)' :
          error.code
        );
      }
    }
  };

  async initUpload(instanceKey: string, uploadStream: PassThrough, fileDetailsMap: Record<string, FileDetail>, fileDetailKey: string): Promise<any> {
    let destinationFolderId: string, fileName: string, mimeType: string, salesforceUrl: string;
    ({ destinationFolderId, salesforceUrl } = await InstanceManager.get(instanceKey, [ MapKey.destinationFolderId, MapKey.salesforceUrl ]));
    ({ fileName, mimeType } = fileDetailsMap[fileDetailKey]);

    const sanitisedName = AWS.sanitiseBucketName(salesforceUrl);
    const fileNameKey = `${destinationFolderId ? destinationFolderId + '/' : ''}${fileName}`;
    if (! await this.bucketExists(sanitisedName)) {
      await this.createBucket(sanitisedName);
    }
    const s3Upload = new Upload({
      client: this.s3Client,
      leavePartsOnError: false, // optional manually handle dropped parts
      params: {
        Bucket: sanitisedName,
        Key: fileNameKey,
        Body: uploadStream,
        ContentType: mimeType,
        ACL: 'public-read'
      }
    });
    return s3Upload;
  }

  async uploadFile(fileDetailsMap: Record<string, FileDetail>, fileDetailKey: string, payload: Record<string, any>): Promise<void> {
    const bytesRead: number = payload.length;
    this.bytesRead += bytesRead;
    const stream = fileDetailsMap[fileDetailKey].uploadStream;
    fileDetailsMap[fileDetailKey].externalBytes = this.bytesRead;
    stream.push(payload);
    MessageEmitter.postProgress(this.instanceKey, fileDetailsMap, fileDetailKey, 'AWS');

    let totalFileSize: number, totalExternalBytes: number;
    totalFileSize = totalExternalBytes = 0;
    for (const detail in fileDetailsMap) {
      totalFileSize += fileDetailsMap[detail].fileSize;
      totalExternalBytes += fileDetailsMap[detail].externalBytes;
    }
    if (totalExternalBytes == totalFileSize) {
      logSuccessResponse(fileDetailsMap[fileDetailKey].fileName, '[AWS.FILE_UPLOAD_END]');
      //SUPER IMPORTANT - busboy doesnt terminate the stream automatically: file stream to external storage will remain open
      stream.end();
      stream.emit('end');
    }
  }

  async endUpload(fileDetails: FileDetail): Promise<CreatedFileDetails> {
    const awsFileCreationResult: CompleteMultipartUploadCommandOutput = await (await fileDetails.file).done();
    const createdFileDetails = new CreatedFileDetails(
      awsFileCreationResult.$metadata.httpStatusCode!,
      awsFileCreationResult.VersionId!,
      awsFileCreationResult.Key!,
      awsFileCreationResult.Location!,
      fileDetails.mimeType,
      AWS.className as Platform
    );
    createdFileDetails.fileSize = fileDetails.fileSize;
    return createdFileDetails;
  }

  private static sanitiseBucketName(bucketName: string): string {
    return bucketName.replace(/((^\w+:|^)\/\/)|\/|:/g, '');
  }
}
