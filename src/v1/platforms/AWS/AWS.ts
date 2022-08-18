'use strict';

import {
    CompleteMultipartUploadCommandOutput,
    CreateBucketCommand,
    GetObjectCommand,
    HeadBucketCommand,
    PutBucketVersioningCommand,
    S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
    CloudFrontClient,
    CreateDistributionCommand,
} from '@aws-sdk/client-cloudfront';
import { Upload } from '@aws-sdk/lib-storage';
import { PassThrough } from 'stream';

import { logSuccessResponse, logErrorResponse } from '../../utils/Logger';
import MessageEmitter from '../../utils/MessageEmitter';
import InstanceManager from '../../utils/InstanceManager';
import {
    CreatedFileDetails,
    StoragePlatform,
    PlatformIdentifier,
} from '../StoragePlatform';
import JsForce from '../../utils/JsForce';

const US_EAST = 'us-east-1';

export class AWS implements StoragePlatform {
    private s3Client: CloudStorageProviderClient;
    private static className: PlatformIdentifier = 'aws';

    public constructor(public instanceKey: string) {}

    static async authorize(
        instanceKey: string
    ): Promise<CloudStorageProviderClient> {
        try {
            const awsInstance = new AWS(instanceKey);
            awsInstance.s3Client = new S3Client({ region: 'us-east-1' });
            logSuccessResponse(instanceKey, '[AWS.AUTHORIZE]');
            return awsInstance;
        } catch (err) {
            logErrorResponse(err, '[AWS.AUTHORIZE]');
            throw err;
        }
    }

    private async createBucket(bucketName: string) {
        try {
            await this.s3Client.send(
                new CreateBucketCommand({ Bucket: bucketName })
            );
            await this.s3Client.send(
                new PutBucketVersioningCommand({
                    Bucket: bucketName,
                    VersioningConfiguration: {
                        MFADelete: 'Disabled',
                        Status: 'Enabled',
                    },
                })
            );
            return true;
        } catch (error: any) {
            logErrorResponse(error.stack, '[AWS.CREATE_BUCKET]');
            return false;
        }
    }

    private async bucketExists(bucketName: string) {
        try {
            await this.s3Client.send(
                new HeadBucketCommand({ Bucket: bucketName })
            );
            return true;
        } catch (error: any) {
            if (error['$metadata'].httpStatusCode === 404) {
                logErrorResponse('No such bucket exists', '[AWS.CHECK_BUCKET]');
                return false;
            } else {
                throw new Error(
                    error['$metadata'].httpStatusCode === 403
                        ? 'Forbidden (most likely due to permissions)'
                        : error.code
                );
            }
        }
    }

    async initUpload(
        instanceKey: string,
        uploadStream: PassThrough,
        fileDetailsMap: Record<string, FileDetail>,
        fileDetailKey: string
    ): Promise<any> {
        try {
            let destinationFolderId: string,
                fileName: string,
                mimeType: string,
                salesforceUrl: string;
            ({ destinationFolderId, salesforceUrl } = await InstanceManager.get(
                instanceKey,
                [MapKey.destinationFolderId, MapKey.salesforceUrl]
            ));
            ({ fileName, mimeType } = fileDetailsMap[fileDetailKey]);

            const sanitisedName = AWS.sanitiseBucketName(salesforceUrl);
            const fileNameKey = `${
                destinationFolderId ? destinationFolderId + '/' : ''
            }${fileName}`;
            console.log({sanitisedName})
            if (!(await this.bucketExists(sanitisedName))) {
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
                    ContentDisposition: 'inline',
                    ACL: 'public-read',
                },
            });
            logSuccessResponse({}, '[AWS.INIT_UPLOAD]');
            return s3Upload;
        } catch (err) {
            logErrorResponse(err, '[AWS.INIT_UPLOAD]');
        }
    }

    async uploadFile(
        fileDetailsMap: Record<string, FileDetail>,
        fileDetailKey: string,
        payload: Record<string, any>
    ): Promise<void> {
        const bytesRead: number = payload.length;
        const stream = fileDetailsMap[fileDetailKey].uploadStream;
        fileDetailsMap[fileDetailKey].externalBytes += bytesRead;
        stream.push(payload);
        MessageEmitter.postProgress(
            this.instanceKey,
            fileDetailsMap,
            fileDetailKey,
            'AWS'
        );
        if (
            fileDetailsMap[fileDetailKey].externalBytes ==
            fileDetailsMap[fileDetailKey].fileSize
        ) {
            logSuccessResponse(
                fileDetailsMap[fileDetailKey].fileName,
                '[AWS.FILE_UPLOAD_END]'
            );
            //SUPER IMPORTANT - busboy doesnt terminate the stream automatically: file stream to external storage will remain open
            stream.end();
            stream.emit('end');
        }
    }

    async endUpload(fileDetails: FileDetail): Promise<CreatedFileDetails> {
        const awsFileCreationResult: CompleteMultipartUploadCommandOutput =
            await (await fileDetails.file).done();
        const createdFileDetails = new CreatedFileDetails(
            awsFileCreationResult.$metadata.httpStatusCode!,
            awsFileCreationResult.VersionId!,
            awsFileCreationResult.Key!,
            awsFileCreationResult.Location!,
            fileDetails.mimeType,
            AWS.className
        );
        createdFileDetails.fileSize = fileDetails.fileSize;
        return createdFileDetails;
    }

    async downloadFile(
        salesforceUrl: string,
        versionId: string,
        key: string
    ): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: AWS.sanitiseBucketName(salesforceUrl),
            Key: key,
            VersionId: versionId,
            ResponseContentDisposition: `attachment; filename="${key}"`,
        });
        return await getSignedUrl(this.s3Client, command, {
            expiresIn: 3600,
        });
    }
    private static sanitiseBucketName(bucketName: string): string {
        return bucketName.replace(/((^\w+:|^)\/\/)|\/|:/g, '');
    }

    async associateDistributionToCDN(bucketId: string | undefined, bucketName: string) {
        try {
            const cfClient = new CloudFrontClient({ region: US_EAST });
            let DomainName:
                | string
                | undefined = `${bucketName}.s3.${US_EAST}.amazonaws.com`;
            const response = await cfClient.send(
                new CreateDistributionCommand({
                    DistributionConfig: {
                        CallerReference: Date.now().toString(),
                        Comment: 'Created by CDM flow',
                        DefaultCacheBehavior: {
                            ForwardedValues: {
                                Cookies: { Forward: 'all' },
                                QueryString: false,
                                Headers: { Quantity: 0 },
                                QueryStringCacheKeys: { Quantity: 0 },
                            },
                            MinTTL: 3600,
                            TargetOriginId: bucketId,
                            TrustedSigners: { Enabled: false, Quantity: 0 },
                            ViewerProtocolPolicy: 'redirect-to-https',
                            DefaultTTL: 86400,
                        },
                        Enabled: true,
                        Origins: {
                            Items: [
                                {
                                    DomainName,
                                    Id: bucketId,
                                    S3OriginConfig: {
                                        OriginAccessIdentity: '',
                                    },
                                },
                            ],
                            Quantity: 1,
                        },
                    },
                })
            );
            DomainName = response.Distribution?.DomainName;
            await JsForce.upsertCustomMetadata(
                this.instanceKey,
                { 'CloudfrontDistribution': DomainName || '' }
            );
            logSuccessResponse({}, '[AWS.ASSOCIATE_DISTRIBUTION]');
        } catch (err) {
            logErrorResponse(err, '[AWS.ASSOCIATE_DISTRIBUTION]');
            throw err;
        }
    }
}
