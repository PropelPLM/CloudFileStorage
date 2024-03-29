'use strict';

import {
    CompleteMultipartUploadCommandOutput,
    CreateBucketCommand,
    GetObjectCommand,
    HeadBucketCommand,
    PutBucketVersioningCommand,
    S3Client
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
    CloudFrontClient,
    CreateDistributionCommand
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
    DADownloadDetails,
    DownloadParams
} from '../StoragePlatform';
import JsForce from '../../utils/JsForce';
import { v4 as uuidv4 } from 'uuid';
import archiver from 'archiver';
import ffmpeg from 'fluent-ffmpeg';
import { createReadStream, createWriteStream, mkdir } from 'fs';

const US_EAST = 'us-east-1',
    PIM_DEFAULT_BUCKET = 'propel-pim-assets',
    DEFAULT_VIDEO_THUMBNAIL_WIDTH = 200,
    DEFAULT_VIDEO_THUMBNAIL_HEIGHT = 200,
    TEMP_DIRECTORY: string = './tmp',
    THUMBNAIL_IDENTIFIER: string = '__thumbnail';

export class AWS implements StoragePlatform {
    private s3Client: CloudStorageProviderClient;
    private static className: PlatformIdentifier = 'aws';

    public constructor(public instanceKey: string) {
        this.s3Client = new S3Client({ region: US_EAST });
    }

    static async authorize(
        instanceKey: string
    ): Promise<CloudStorageProviderClient> {
        try {
            const awsInstance = new AWS(instanceKey);
            logSuccessResponse(instanceKey, '[AWS.AUTHORIZE]');
            return awsInstance;
        } catch (err) {
            logErrorResponse(err, '[AWS.AUTHORIZE]');
            throw err;
        }
    }

    async initUpload(
        instanceKey: string,
        uploadStream: PassThrough,
        fileDetailsMap: Record<string, FileDetail>,
        fileDetailKey: string
    ): Promise<any> {
        try {
            let mimeType: string | undefined, orgId: string;
            ({ orgId } = await InstanceManager.get(instanceKey, [
                MapKey.orgId
            ]));
            ({ mimeType } = fileDetailsMap[fileDetailKey]);

            const fileNameKey = `${orgId}/${uuidv4()}`;
            if (!(await this.bucketExists(PIM_DEFAULT_BUCKET))) {
                await this.createBucket(PIM_DEFAULT_BUCKET);
            }
            const s3Upload = new Upload({
                client: this.s3Client,
                leavePartsOnError: false, // optional manually handle dropped parts
                params: {
                    Bucket: PIM_DEFAULT_BUCKET,
                    Key: fileNameKey,
                    Body: uploadStream,
                    ContentType: mimeType,
                    ContentDisposition: 'inline'
                }
            });
            logSuccessResponse({}, '[AWS.INIT_UPLOAD]');
            return s3Upload;
        } catch (err) {
            console.log({ err });
            logErrorResponse(err, '[AWS.INIT_UPLOAD]');
        }
    }

    async uploadFile(
        fileDetailsMap: Record<string, FileDetail>,
        fileDetailKey: string,
        payload: Record<string, any>
    ): Promise<void> {
        try {
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
                //SUPER IMPORTANT - busboy doesnt terminate the stream automatically: file stream to external storage will remain open
                stream.end();
                stream.emit('end');
                logSuccessResponse(
                    fileDetailsMap[fileDetailKey].fileName,
                    '[AWS.FILE_UPLOAD_END]'
                );
            }
        } catch (err) {
            console.log({ err });
            logErrorResponse(err, '[AWS.UPLOAD_FILE]');
        }
    }

    async endUpload(
        fileDetailsMap: Record<string, FileDetail>,
        fileDetailKey: string
    ): Promise<CreatedFileDetails> {
        const fileDetails = fileDetailsMap[fileDetailKey];
        const awsFileCreationResult: CompleteMultipartUploadCommandOutput =
            await (await fileDetails.file).done();
        const createdFileDetails = new CreatedFileDetails(
            awsFileCreationResult.$metadata.httpStatusCode!,
            awsFileCreationResult.VersionId!,
            fileDetails.fileName,
            awsFileCreationResult.Key!,
            fileDetails.mimeType,
            AWS.className
        );
        createdFileDetails.fileSize = fileDetails.fileSize;

        logSuccessResponse(
            `File created with key: ${awsFileCreationResult?.Key}`,
            '[AWS.UPLOAD]'
        );
        if (fileDetails.mimeType!.startsWith('video')) {
            this.generateAndUploadVideoThumbnail(awsFileCreationResult.Key);
        }
        return createdFileDetails;
    }

    async downloadFile(options: Partial<DownloadParams>): Promise<string> {
        const daDownloadDetailsList: Array<DADownloadDetails> =
            options.daDownloadDetailsList!!;
        const hostName: string = options.hostName!!;
        const sessionId: string = options.sessionId!!;
        const zipFileName: string = options.zipFileName!!;
        if (!zipFileName && daDownloadDetailsList.length === 1) {
            const downloadDetails = options?.daDownloadDetailsList?.[0];
            const command = new GetObjectCommand({
                Bucket: PIM_DEFAULT_BUCKET,
                Key: downloadDetails?.key,
                VersionId: downloadDetails?.fileId,
                ResponseContentDisposition: `attachment; filename="${
                    downloadDetails?.fileName ?? downloadDetails?.key
                }"`
            });
            return await getSignedUrl(this.s3Client, command, {
                expiresIn: 3600
            });
        } else {
            mkdir(TEMP_DIRECTORY, { recursive: true }, (err) => {
                if (err && err.code != 'EEXIST') throw err;
            });
            const output = createWriteStream(
                `${TEMP_DIRECTORY}/${zipFileName}`
            );
            const archive = archiver('zip', { zlib: { level: 9 } });
            archive.pipe(output);
            const zipPromises = daDownloadDetailsList.map(
                async (detail: DADownloadDetails) => {
                    const command = new GetObjectCommand({
                        Bucket: PIM_DEFAULT_BUCKET,
                        Key: detail?.key,
                        VersionId: detail?.fileId,
                        ResponseContentDisposition: `attachment; filename="${
                            detail?.fileName ?? detail?.key
                        }"`
                    });
                    const { Body } = await this.s3Client.send(command);
                    archive.append(Body, {
                        name: detail?.fileName ?? detail?.key!!
                    });
                }
            );
            await Promise.all(zipPromises);
            archive.on('finish', function () {
                JsForce.postToChatter(zipFileName, sessionId, hostName);
            });
            archive.finalize();
            return 'Download processing. Please check Chatter.';
        }
    }

    // private static sanitiseBucketName(bucketName: string): string {
    //     return bucketName.replace(/((^\w+:|^)\/\/)|\/|:/g, '');
    // }

    private static removeFSUnfriendlyChars(fileName: string): string {
        return fileName.replace(/[\#\%\&\{\}\\\<\>\*\?\/\$\!\'\"\:]/g, '_');
    }

    async associateDistributionToCDN(
        bucketId: string | undefined,
        bucketName: string
    ) {
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
                                QueryStringCacheKeys: { Quantity: 0 }
                            },
                            MinTTL: 3600,
                            TargetOriginId: bucketId,
                            TrustedSigners: { Enabled: false, Quantity: 0 },
                            ViewerProtocolPolicy: 'redirect-to-https',
                            DefaultTTL: 86400
                        },
                        Enabled: true,
                        Origins: {
                            Items: [
                                {
                                    DomainName,
                                    Id: bucketId,
                                    S3OriginConfig: {
                                        OriginAccessIdentity: ''
                                    }
                                }
                            ],
                            Quantity: 1
                        }
                    }
                })
            );
            DomainName = response.Distribution?.DomainName;
            await JsForce.upsertCustomMetadata(this.instanceKey, {
                CloudfrontDistribution: DomainName || ''
            });
            logSuccessResponse({}, '[AWS.ASSOCIATE_DISTRIBUTION]');
        } catch (err) {
            logErrorResponse(err, '[AWS.ASSOCIATE_DISTRIBUTION]');
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
                        Status: 'Enabled'
                    }
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

    private async generateAndUploadVideoThumbnail(key: string | undefined) {
        if (key == null) return;

        const DATA_WITHIN_KEY_REGEX = /^([a-zA-Z0-9]*\/)([a-zA-Z0-9-\/]*)/;
        const match = key.match(DATA_WITHIN_KEY_REGEX);
        if (!match) return;

        const orgId: string = match[1];
        const assetKey: string = match[2];
        try {
            const command = new GetObjectCommand({
                Bucket: PIM_DEFAULT_BUCKET,
                Key: key
            });
            const { Body } = await this.s3Client.send(command);
            const fileName = AWS.removeFSUnfriendlyChars(
                key.substring(key.lastIndexOf('/') + 1)
            );
            mkdir(TEMP_DIRECTORY, { recursive: true }, (err) => {
                if (err && err.code != 'EEXIST') throw err;
            });
            const localFilePath = `${TEMP_DIRECTORY}/${fileName}`;
            const fileStream = createWriteStream(localFilePath);
            Body.pipe(fileStream);
            fileStream
                .on('close', () => {
                    console.log(`S3 object saved locally as ${localFilePath}`);
                })
                .on('error', (error) => {
                    console.error('Error writing file:', error);
                })
                .on('finish', () => {
                    ffmpeg(localFilePath)
                        .on('end', async () => {
                            logSuccessResponse(
                                `Thumbnail(${DEFAULT_VIDEO_THUMBNAIL_WIDTH}x${DEFAULT_VIDEO_THUMBNAIL_HEIGHT}) for ${key} created successfully.`,
                                '[FFMPEG.GENERATE_VIDEO_THUMBNAIL]'
                            );
                            await new Upload({
                                client: this.s3Client,
                                leavePartsOnError: false,
                                params: {
                                    Bucket: PIM_DEFAULT_BUCKET,
                                    Key: `${orgId}thumbnails/${assetKey}__d=${DEFAULT_VIDEO_THUMBNAIL_WIDTH}x${DEFAULT_VIDEO_THUMBNAIL_HEIGHT}`,
                                    Body: createReadStream(
                                        `${TEMP_DIRECTORY}/${fileName}${THUMBNAIL_IDENTIFIER}.png`
                                    ),
                                    ContentType: 'image/png',
                                    ContentDisposition: 'inline'
                                }
                            }).done();
                        })
                        .on('error', (err: any) => {
                            console.log({ err });
                            logErrorResponse(
                                err,
                                '[FFMPEG.GENERATE_VIDEO_THUMBNAIL]'
                            );
                        })
                        .screenshots({
                            count: 1,
                            folder: TEMP_DIRECTORY,
                            filename: `${fileName}${THUMBNAIL_IDENTIFIER}`,
                            size: `${DEFAULT_VIDEO_THUMBNAIL_WIDTH}x${DEFAULT_VIDEO_THUMBNAIL_HEIGHT}`
                        });
                });
        } catch (err) {
            logErrorResponse(err, '[AWS.VIDEO_THUMBNAIL]');
        }
    }
}
