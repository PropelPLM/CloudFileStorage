// @ts-nocheck
// TODO: find another way to enforce type safety OR get ts to realise this is a jest file
import { google } from 'googleapis';
import { Client, ResponseType, authClient } from '@microsoft/microsoft-graph-client';
import Office365 from '../../../platforms/Office365/Office365';
import GoogleDrive from '../../../platforms/GoogleDrive/GoogleDrive';
import InstanceManager from '../../../utils/InstanceManager';
import MessageEmitter from '../../../utils/MessageEmitter';
import data from '../../data/mockData.json';
import '../../../../../jest.extend';
import XlsxPopulate from 'xlsx-populate';

jest
  .mock('axios')
  .mock('@microsoft/microsoft-graph-client')
  .mock('xlsx-populate')
  .mock('../../../utils/Logger')
  .mock('../../../utils/MessageEmitter')
  .mock('../../../utils/InstanceManager');

const instanceMap: Record<string, Partial<IMap>> = data.instanceMap;
const instanceKey1 = data.instanceKey1;
const instanceKey2 = data.instanceKey2;

describe ('Office365 test suite', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await MessageEmitter.tearDown('[INDIRECT] Office365');
  })

  describe('helper methods', ()=> {
    it('create buffer for empty xlsx file', async() => {
      await Office365.createXlsxFileBuffer();

      expect(XlsxPopulate.fromBlankAsync).toBeCalledTimes(1);
      const buffer = await XlsxPopulate.fromBlankAsync.mock.results[0].value;
      expect(buffer.outputAsync).toBeCalledTimes(1);
    });

    it('construct object for drive item creation', async() => {
      const webUrl = 'dummy';
      Office365.promisifiedShorten = jest.fn().mockResolvedValue(webUrl);
      const res = await Office365.constructDriveItem({id: 'test', name: 'test', webUrl});

      expect(Office365.promisifiedShorten).toBeCalledTimes(1);
      expect(Office365.promisifiedShorten).toBeCalledWith(webUrl);

      const viewLink = await Office365.promisifiedShorten.mock.results[0].value;
      expect(res).toEqual(expect.objectContaining({ viewLink }));
    });

    it('retrieve groupId', async() => {
      await Office365.getGroupId(instanceKey1, authClient);
      expect(authClient.api).toBeCalledTimes(1);
      expect(authClient.api).toBeCalledWith('groups');
      // chained method call
      expect(authClient.api.mock.results[0].value.get).toBeCalledTimes(1);

      expect(InstanceManager.upsert).toBeCalledTimes(1);
      expect(InstanceManager.upsert).toBeCalledWith(instanceKey1, expect.objectContaining(
        {
          groupId: expect.anything()
        }
      ));
    });

    it('retrieve drive item', async() => {
      const groupId = 'groupId';
      const driveItemId = 'driveItemId';
      Office365.constructDriveItem = jest.fn();
      await Office365.getDriveItem(authClient, groupId, driveItemId);

      expect(authClient.api).toBeCalledTimes(1);
      expect(authClient.api).toBeCalledWith(`/groups/${groupId}/drive/items/${driveItemId}`)
      // chained method call
      expect(authClient.api.mock.results[0].value.get).toBeCalledTimes(1);

      expect(Office365.constructDriveItem).toBeCalledTimes(1);
      expect(Office365.constructDriveItem).toBeCalledWith(authClient.api.mock.results[0].value.get.mock.results[0].value);
    });

    it('retrieve folder and drive id', async() => {
      const groupId = 'groupId';
      const folderName = 'folderName';
      Office365.getFolderAndDriveId(authClient, groupId, folderName);
      expect(authClient.api).toBeCalledTimes(1);
      expect(authClient.api).toBeCalledWith(`/groups/${groupId}/drive/root:/${folderName}`)
      // chained method call
      expect(authClient.api.mock.results[0].value.get).toBeCalledTimes(1);
    });
  })

  describe('authorization flow', () => {
    it('authorize and upsert client with middleware', async () => {
      const clientId = instanceMap[instanceKey1].clientId;
      const clientSecret = instanceMap[instanceKey1].clientSecret;
      const tokens = {};
      await Office365.authorize(instanceKey1, clientId, clientSecret, tokens);

      expect(InstanceManager.get).toBeCalledTimes(1);
      expect(InstanceManager.get).toBeCalledWith(instanceKey1, ['tenantId']);

      expect(Client.initWithMiddleware).toBeCalledTimes(1);

      expect(InstanceManager.upsert).toBeCalledTimes(1);
      expect(InstanceManager.upsert).toBeCalledWith(instanceKey1, expect.objectContaining(
        {
          oAuth2Client: Client.initWithMiddleware.mock.results[0].value
        }
      ));

    });
  });

  describe('file operations', () => {
    it('create file', async () => {
      Office365.constructDriveItem = jest.fn();
      Office365.createXlsxFileBuffer = jest.fn();

      // xlsx
      let type = 'xlsx';
      let fileName = 'fileName';
      await Office365.createFile(instanceKey1, type, fileName);

      expect(InstanceManager.get).toBeCalledTimes(1);
      expect(InstanceManager.get).toBeCalledWith(instanceKey1, ['oAuth2Client', 'destinationFolderId', 'groupId']);
      let {groupId, destinationFolderId} = InstanceManager.get.mock.results[0].value;
      const xlsxCreationEndpoint = `/groups/${groupId}/drive/items/root:/${destinationFolderId}/${fileName}.${type}:/content`

      expect(authClient.api).toBeCalledTimes(1);
      expect(authClient.api).toBeCalledWith(xlsxCreationEndpoint);
      // chained method call
      expect(authClient.api.mock.results[0].value.put).toBeCalledTimes(1);
      expect(Office365.createXlsxFileBuffer).toBeCalledTimes(1);
      expect(authClient.api.mock.results[0].value.put).toBeCalledWith(Office365.createXlsxFileBuffer.mock.results[0].value);

      expect(Office365.constructDriveItem).toBeCalledTimes(1);
      expect(Office365.constructDriveItem).toBeCalledWith(authClient.api.mock.results[0].value.put.mock.results[0].value);

      // any other format
      type = 'docx';
      await Office365.createFile(instanceKey1, type, fileName);
      expect(InstanceManager.get).toBeCalledTimes(2);
      expect(authClient.api).toBeCalledTimes(2);
      // chained method call
      expect(authClient.api.mock.results[1].value.put).toBeCalledTimes(2);
      expect(authClient.api.mock.calls[1]).not.toBe(xlsxCreationEndpoint);
      expect(Office365.createXlsxFileBuffer).toBeCalledTimes(1);
      expect(authClient.api.mock.results[1].value.put).toBeCalledWith('');

      // construct was NOT reset
      expect(Office365.constructDriveItem).toBeCalledTimes(2);
      expect(Office365.constructDriveItem).toBeCalledWith(authClient.api.mock.results[1].value.put.mock.results[0].value);
    });

    it('clone file', async () => {
      const itemId = 'itemId';
      const driveId = 'driveId';
      const folderId = 'folderId';
      const fileId = 'fileId';
      const fileName = 'fileName';
      const folderName = 'folderName';
      const postPayload = {
        "parentReference": {
          "driveId": driveId,
          "id": folderId
        },
        "name": fileName
      }

      Office365.getItemIdFromMonitorURL = jest.fn().mockResolvedValue(itemId);
      Office365.getDriveItem = jest.fn();
      Office365.getFolderAndDriveId = jest.fn().mockResolvedValue({folderId, driveId});

      await Office365.cloneFile(instanceKey1, fileId, fileName, folderName);

      expect(InstanceManager.get).toBeCalledTimes(1);
      expect(InstanceManager.get).toBeCalledWith(instanceKey1, ['oAuth2Client', 'groupId']);
      let {groupId} = InstanceManager.get.mock.results[0].value;
      const cloneMonitorEndpoint = `/groups/${groupId}/drive/items/${fileId}/copy`;

      expect(authClient.api).toBeCalledTimes(1);
      expect(authClient.api).toBeCalledWith(cloneMonitorEndpoint);
      expect(authClient.api.mock.results[0].value.responseType).toBeCalledTimes(1);
      expect(authClient.api.mock.results[0].value.responseType).toBeCalledWith(ResponseType.RAW);
      // chained method call
      expect(authClient.api.mock.results[0].value.post).toBeCalledTimes(1);
      expect(authClient.api.mock.results[0].value.post).toBeCalledWith(postPayload);

      expect(Office365.getItemIdFromMonitorURL).toBeCalledTimes(1);
      expect(Office365.getDriveItem).toBeCalledTimes(1);
      expect(Office365.getDriveItem).toBeCalledWith(authClient, groupId, itemId);
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
      expect(file).toBe(instanceMap[instanceKey1].file);
    });
  });
})
