// @ts-nocheck
// TODO: find another way to enforce type safety OR get ts to realise this is a jest file
import { google } from 'googleapis';
import GoogleDrive from '../../platforms/GoogleDrive';
import InstanceManager from '../../utils/InstanceManager';
import { logErrorResponse, logSuccessResponse } from '../../utils/Logger';
import data from '../data/mockData.json';
import "../../../../jest.extend";

jest
  .mock('googleapis')
  .mock('stream')
  .mock('../../utils/Logger')
  .mock('../../utils/MessageEmitter')
  .mock('../../utils/InstanceManager');

const instanceMap: Record<string, Partial<IMap>> = data.instanceMap;
const instanceKey1 = data.instanceKey1;
const instanceKey2 = data.instanceKey2;

describe ('GoogleDrive test suite', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('authorization flow', () => {
    it('createAuthUrl generates correct URL', () => {
      const clientId = instanceMap[instanceKey1].clientId;
      const clientSecret = instanceMap[instanceKey1].clientSecret;
      const redirectUri = '/auth/callback/google';
      const url = GoogleDrive.createAuthUrl({ clientId, clientSecret, redirectUri }, instanceKey1);
      
      expect(url).toBeType('string');
      expect(InstanceManager.upsert).toBeCalledTimes(1);

      expect(google.auth.OAuth2).toBeCalledTimes(1);
      expect(google.auth.OAuth2.mock.results[0].value.generateAuthUrl)
        .toBeCalledWith(expect.objectContaining({
          state: Buffer.from(instanceKey1).toString('base64')
        }));
    });

    it('getTokens returns tokens', () => {
      // happy path
      GoogleDrive.getTokens('code', instanceKey1);
      expect(InstanceManager.get).toBeCalledWith(instanceKey1, ['oAuth2Client']);
      expect(InstanceManager.get.mock.results[0].value.oAuth2Client.getToken).toBeCalledWith('code');
      expect(logSuccessResponse).toBeCalledTimes(1);
      
      // exception simulated by only having getToken return value once
      GoogleDrive.getTokens('code', instanceKey2);
      expect(InstanceManager.get).toBeCalledWith(instanceKey2, ['oAuth2Client']);
      expect(logErrorResponse).toBeCalledTimes(1);
    });
  });

  describe('upload flow', () => {
    it('authorize drive client', () => {
      // happy path
      const clientId = instanceMap[instanceKey1].clientId;
      const clientSecret = instanceMap[instanceKey1].clientSecret;
      const redirectUri = '/auth/callback/google';
      GoogleDrive.authorize({ clientId, clientSecret, redirectUri }, instanceKey1);

      expect(InstanceManager.upsert).toBeCalledTimes(1);
      expect(google.auth.OAuth2).toBeCalledTimes(1);
      expect(google.auth.OAuth2.mock.results[0].value.setCredentials).toBeCalledTimes(1);
      expect(logSuccessResponse).toBeCalledTimes(1);

      // exception simulated by only having getToken return value once
      GoogleDrive.authorize({ clientId, clientSecret, redirectUri }, instanceKey1);
      expect(logErrorResponse).toBeCalledTimes(1);
    });

    it('initUpload creates drive client and file stream with correct details', async () => {
      const fileName = instanceMap[instanceKey1].fileName;
      const mimeType = instanceMap[instanceKey1].mimeType;
      const fileSize = instanceMap[instanceKey1].fileSize;
      await GoogleDrive.initUpload(instanceKey1, { fileName, mimeType, fileSize });

      expect(InstanceManager.get).toBeCalledWith(instanceKey1, ['destinationFolderId', 'oAuth2Client']);
      expect(InstanceManager.upsert).toBeCalledWith(instanceKey1, expect.objectContaining(
        {
          file: expect.anything(),
          uploadStream: expect.anything()
        }
      ));

      expect(google.drive)
        .toBeCalledWith(
          expect.objectContaining({ auth: expect.any(Object) })
        );
      expect(google.drive.mock.results[0].value.files.create.mock.calls[0][0].resource)
        .toMatchObject({
          name: fileName,
          driveId: instanceMap[instanceKey1].destinationFolderId  
        });
      expect(google.drive.mock.results[0].value.files.create.mock.calls[0][0].media)
        .toMatchObject({
          mimeType: instanceMap[instanceKey1].mimeType,
        });
    });

    it('initUpload creates separate drive clients and file streams for different instances', () => {
      [instanceKey1, instanceKey2].forEach(async key => {
        const fileName = instanceMap[key].fileName;
        const mimeType = instanceMap[key].mimeType;
        const fileSize = instanceMap[key].fileSize;
        await GoogleDrive.initUpload(key, { fileName, mimeType, fileSize });
      });

      expect(InstanceManager.get).toHaveBeenCalledTimes(2);
      expect(InstanceManager.upsert).toHaveBeenCalledTimes(2);
      expect(InstanceManager.upsert.mock.calls[0]).not.toEqual(InstanceManager.upsert.mock.calls[1]);

      expect(google.drive.mock.results[0].value.files.create.mock.calls[0][0])
        .not.toEqual(google.drive.mock.results[1].value.files.create.mock.calls[0][0]);
    });

    it('uploadFile updates file stream', async () => {
      await GoogleDrive.uploadFile(instanceKey1, {});

      expect(InstanceManager.get).toHaveBeenCalledTimes(1);
      expect(InstanceManager.upsert).toHaveBeenCalledTimes(1);
      expect(InstanceManager.get(instanceKey1, ['uploadStream']).uploadStream)
        .toEqual(expect.objectContaining({
          percent: expect.any(Number)
        }));
    });

    it('different client calls to uploadFile updates their own file streams', async () => {
      await GoogleDrive.uploadFile(instanceKey1, {});
      await GoogleDrive.uploadFile(instanceKey2, {});

      expect(InstanceManager.get).toHaveBeenCalledTimes(2);
      expect(InstanceManager.upsert).toHaveBeenCalledTimes(2);
      expect(InstanceManager.upsert.mock.calls[0][0])
        .not.toEqual(InstanceManager.upsert.mock.calls[1][0]);
    });

    it('endUpload returns file', async () => {
      const file = await GoogleDrive.endUpload(instanceKey1);
      expect(file).toBe(instanceMap[instanceKey1]['file']);
    });
  });
})
