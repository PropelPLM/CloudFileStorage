//@ts-nocheck
'use strict';

import GoogleDrive from '../../platforms/GoogleDrive';
import InstanceManager from '../../utils/InstanceManager';
import JsForce from '../../utils/JsForce';
import { logErrorResponse, logSuccessResponse } from '../../utils/Logger';
import MessageEmitter from '../../utils/MessageEmitter';
import supertest from 'supertest'
import busboy from 'busboy'
import data from '../data/mockData.json';
const server = require('../../main');
const request = supertest(server);

jest
  .mock('busboy')
  .mock('../../platforms/GoogleDrive')
  .mock('../../utils/InstanceManager')
  .mock('../../utils/JsForce')
  .mock('../../utils/Logger')
  .mock('../../utils/MessageEmitter');

const baseUrl = '/upload';
const instanceMap: Record<string, Partial<IMap>> = data.instanceMap;
const instanceKey1 = data.instanceKey1;

describe("uploadRouter test suite", () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /token/:instanceKey', () => {
    it('post succeeds and registers with instance manager, authorizes with external platform and connects to SF Apex', async () => {
        const client_id = instanceMap[instanceKey1].clientId;
        const client_secret = instanceMap[instanceKey1].clientSecret;
        const access_token = instanceMap[instanceKey1].accessToken;
        const refresh_token = instanceMap[instanceKey1].refreshToken;
        const expiry_date = instanceMap[instanceKey1].expiryDate;
        const sessionId = instanceMap[instanceKey1].sessionId;
        const salesforceUrl = instanceMap[instanceKey1].salesforceUrl;
        const tokens = { client_id, client_secret, access_token, refresh_token, expiry_date, sessionId, salesforceUrl };

        await request
        .post(`${baseUrl}/token/${instanceKey1}`)
        .send(tokens)
        .expect(200)
        .expect(res => res.constructor === Object && res.access_token);
        
        expect(InstanceManager.register).toBeCalledTimes(1);
        expect(InstanceManager.register).toBeCalledWith(instanceKey1);
        
        expect(GoogleDrive.authorize).toBeCalledTimes(1);
        expect(GoogleDrive.authorize).toBeCalledWith(instanceKey1, client_id, client_secret,
            {
                access_token,
                refresh_token,
                scope: expect.any(String),
                token_type: 'Bearer',
                expiry_date
            }
        );

        expect(InstanceManager.upsert).toBeCalledTimes(1);
        expect(InstanceManager.upsert).toBeCalledWith(instanceKey1, { salesforceUrl });

        expect(JsForce.connect).toBeCalledTimes(1);
        expect(JsForce.connect).toBeCalledWith(sessionId, salesforceUrl, instanceKey1);

        expect(logSuccessResponse).toBeCalledTimes(1);
    });

    it('post fails due to bad/missing credentials and no connection to JsForce is established.', async () => {
      GoogleDrive.authorize = jest.fn(() => {throw new Error()});
      const client_id = instanceMap[instanceKey1].clientId;
      const client_secret = instanceMap[instanceKey1].clientSecret;
      const access_token = instanceMap[instanceKey1].accessToken;
      const refresh_token = instanceMap[instanceKey1].refreshToken;
      const expiry_date = instanceMap[instanceKey1].expiryDate;
      const sessionId = instanceMap[instanceKey1].sessionId;
      const salesforceUrl = instanceMap[instanceKey1].salesforceUrl;
      const tokens = { client_id, client_secret, access_token, refresh_token,expiry_date, sessionId, salesforceUrl };
  
      await request
        .post(`${baseUrl}/token/${instanceKey1}`)
        .send(tokens)
        .expect(400)
        
      expect(InstanceManager.register).toBeCalledTimes(1);
      expect(InstanceManager.register).toBeCalledWith(instanceKey1);
      
      expect(GoogleDrive.authorize).toBeCalledTimes(1);
  
      expect(InstanceManager.upsert).not.toHaveBeenCalled();
      expect(JsForce.connect).not.toHaveBeenCalled();
      expect(logSuccessResponse).not.toHaveBeenCalled();
      
      expect(logErrorResponse).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /uploadDetails/:instanceKey', () => {
    it('post succeeds in updating details of the upload', async () => {
      const destinationFolderId = instanceMap[instanceKey1].destinationFolderId;
      const revisionId = instanceMap[instanceKey1].revisionId;
      const isNew = instanceMap[instanceKey1].isNew;
      const instanceDetails = { revisionId, destinationFolderId, isNew }; 
      await request
        .post(`${baseUrl}/uploadDetails/${instanceKey1}`)
        .send(instanceDetails)
        .expect(200)
        .expect(res =>  res.constructor === Object && res.instanceKey);

      expect(InstanceManager.upsert).toBeCalledTimes(1);
      expect(InstanceManager.upsert).toBeCalledWith(instanceKey1, instanceDetails);

      expect(logSuccessResponse).toBeCalledTimes(1);
    });
    
    it('post fails to update details of the upload', async () => {
      InstanceManager.upsert = jest.fn().mockImplementationOnce(() => {throw new Error()})
      await request
        .post(`${baseUrl}/uploadDetails/${instanceKey1}`)
        .expect(400)

      expect(InstanceManager.upsert).toBeCalledTimes(1);

      expect(logSuccessResponse).not.toHaveBeenCalled();

      expect(logErrorResponse).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /:instanceKey', () => {
    const mockedEventMap = {};
    const chainableEventListener = function(event, cb) {
      mockedEventMap[event] = cb;
      return this;
    };

    const mockFileStream = {
      on: chainableEventListener
    };

    beforeAll(() => {
      busboy.mockImplementation(() => {
        return {
          on: chainableEventListener,
          end: jest.fn()
        }
      });
    });

    /** a refactor on the router is required to make the code more testable
     *  supertest is unable to mock the express objects and hence cannot touch req.pipe
     *  'normal' application flow here will eventually be thrown due to req.pipe
     *  saving the callbacks and rerunning them by invoking them manually with mockedEventMap helps test methods
     *  hence both success and failure routes are tested here in this test case 
     **/
    it('post sends writes chunk of file into platform client\'s pipe', async () => {
      const salesforceUrl = instanceMap[instanceKey1].salesforceUrl;
      const isNew = instanceMap[instanceKey1].isNew;
      const fileName = instanceMap[instanceKey1].fileName;
      const mimeType = instanceMap[instanceKey1].mimeType;
      const fileSize = instanceMap[instanceKey1].fileSize;

      await request
        .post(`${baseUrl}/${instanceKey1}`)
        .send({ salesforceUrl, isNew })

      mockedEventMap['field']('fileSize', fileSize); //coverage

      await mockedEventMap['file']('', mockFileStream, fileName, '', mimeType);
      expect(GoogleDrive.initUpload).toBeCalledTimes(1);
      expect(GoogleDrive.initUpload).toBeCalledWith(instanceKey1, {fileName, mimeType, fileSize});

      expect(InstanceManager.upsert).toBeCalledTimes(1);
      expect(InstanceManager.upsert).toBeCalledWith(instanceKey1, { fileName, frontendBytes: 0, externalBytes: 0, fileSize});

      const mockFileData = new Array(10); //simulates file data
      await mockedEventMap['data'](mockFileData); 
      expect(InstanceManager.upsert).toBeCalledTimes(2);
      expect(InstanceManager.upsert).toBeCalledWith(instanceKey1, { frontendBytes: 10});

      expect(MessageEmitter.postProgress).toBeCalledTimes(1);
      expect(MessageEmitter.postProgress).toBeCalledWith(instanceKey1, 'FRONTEND');

      expect(GoogleDrive.uploadFile).toBeCalledTimes(1);
      expect(GoogleDrive.uploadFile).toBeCalledWith(instanceKey1, mockFileData);

      mockedEventMap['error']();
      expect(logErrorResponse).toBeCalledTimes(2); // error event and req.pipe catch
      
      GoogleDrive.endUpload = jest.fn().mockResolvedValueOnce({data: 'dummyData', status: 200})
      JsForce.create = jest.fn().mockResolvedValueOnce({id: 'dummyId'});
      try {
        await mockedEventMap['finish']();
      } catch (err) {
        expect(err.message).toBe('Cannot set headers after they are sent to the client');
      };
      expect(GoogleDrive.endUpload).toBeCalledTimes(1);
      expect(GoogleDrive.endUpload).toBeCalledWith(instanceKey1);
      expect(JsForce.create).toBeCalledTimes(1);
      expect(JsForce.create).toBeCalledWith('dummyData', instanceKey1);
    });
  });
});