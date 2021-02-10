//@ts-nocheck
'use strict';

import GoogleDrive from '../../platforms/GoogleDrive';
import InstanceManager from '../../utils/InstanceManager';
import JsForce from '../../utils/JsForce';
import { logErrorResponse, logSuccessResponse } from '../../utils/Logger';
import MessageEmitter from '../../utils/MessageEmitter';
import supertest from 'supertest'
import data from '../data/mockData.json';
const server = require('../../main');
const request = supertest(server);

jest
  .mock('../../platforms/GoogleDrive')
  .mock('../../utils/InstanceManager')
  .mock('../../utils/JsForce')
  .mock('../../utils/Logger')
  .mock('../../utils/MessageEmitter');

const baseUrl = '/auth';
const instanceMap: Record<string, Partial<IMap>> = data.instanceMap;
const instanceKey1 = data.instanceKey1;

describe("authRouter test suite", () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /:instanceKey', async () => {
    await request
      .get(`${baseUrl}/${instanceKey1}`)
      .expect(200)
      .expect(res => '<!DOCTYPE html>' in res);

    expect(InstanceManager.register).toBeCalledTimes(1);
    expect(InstanceManager.register).toBeCalledWith(instanceKey1);
  });

  describe('POST /:instanceKey', () => {
    it('post succeeds and sets attribute on instance', async () => {
      const sessionId = instanceMap[instanceKey1].sessionId;
      const salesforceUrl = instanceMap[instanceKey1].salesforceUrl;
      const clientId = instanceMap[instanceKey1].clientId;
      const clientSecret = instanceMap[instanceKey1].clientSecret;
      await request
        .post(`${baseUrl}/${instanceKey1}`)
        .send({ sessionId, salesforceUrl, clientId, clientSecret })
        .expect(200)
        .expect(res =>  res.constructor === Object && res.url);

      expect(InstanceManager.register).toBeCalledTimes(1);
      expect(InstanceManager.register).toBeCalledWith(instanceKey1);
      expect(InstanceManager.upsert).toBeCalledTimes(1);
      expect(InstanceManager.upsert).toBeCalledWith(instanceKey1, { salesforceUrl, clientId, clientSecret });

      expect(JsForce.connect).toBeCalledTimes(1);
      expect(JsForce.connect).toBeCalledWith(sessionId, salesforceUrl, instanceKey1);

      expect(GoogleDrive.createAuthUrl).toBeCalledTimes(1);
      expect(GoogleDrive.createAuthUrl).toHaveBeenCalledWith(expect.objectContaining({
        clientId,
        clientSecret,
        redirect_uri: expect.any(String)
      }), instanceKey1);
      expect(GoogleDrive.createAuthUrl.mock.calls[0][0].redirect_uri).toContain('/auth/callback');

      expect(MessageEmitter.setAttribute).toBeCalledTimes(1);
      expect(MessageEmitter.setAttribute).toBeCalledWith(instanceKey1, 'target-window', salesforceUrl);

      expect(logSuccessResponse).toBeCalledTimes(1);
    });

    it('post fails as clientId and secret are not properly configured in SF Apex', async () => {
      const sessionId = instanceMap[instanceKey1].sessionId;
      const salesforceUrl = instanceMap[instanceKey1].salesforceUrl;
      const clientId = '';
      const clientSecret = '';
      await request
        .post(`${baseUrl}/${instanceKey1}`)
        .send({ sessionId, salesforceUrl, clientId, clientSecret })
        .expect(400)
        .expect(res =>  res.constructor === String);

      expect(InstanceManager.register).toBeCalledTimes(1);
      expect(InstanceManager.register).toBeCalledWith(instanceKey1);
      expect(InstanceManager.upsert).toBeCalledTimes(1);
      expect(InstanceManager.upsert).toBeCalledWith(instanceKey1, { salesforceUrl, clientId, clientSecret });

      expect(JsForce.connect).toBeCalledTimes(1);
      expect(JsForce.connect).toBeCalledWith(sessionId, salesforceUrl, instanceKey1);

      expect(GoogleDrive.createAuthUrl).not.toHaveBeenCalled();

      expect(MessageEmitter.setAttribute).not.toHaveBeenCalled();
      expect(logSuccessResponse).not.toHaveBeenCalled();

      expect(logErrorResponse).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /callback/:platform (callback from external platform)', () => {
    it('callback succeeds and sends tokens to SF Apex', async () => {
      GoogleDrive.getTokens = jest.fn().mockResolvedValueOnce({ tokens: {} });
      const code = 'dummyCode';
      await request
        .get(`${baseUrl}/callback/google`)
        .query({
          state: Buffer.from(instanceKey1).toString('base64'),
          code
        })
        .expect(200)
        .expect(res => res === '<script>window.close()</script>');

        expect(GoogleDrive.getTokens).toBeCalledTimes(1);
        expect(GoogleDrive.getTokens).toBeCalledWith(code, instanceKey1);

        expect(InstanceManager.get).toBeCalledTimes(1);
        expect(InstanceManager.get.mock.calls[0][0]).toBe(instanceKey1);

        expect(JsForce.sendTokens).toBeCalledTimes(1);
        expect(JsForce.sendTokens).toBeCalledWith({
          clientId: instanceMap[instanceKey1].clientId,
          clientSecret: instanceMap[instanceKey1].clientSecret
        }, instanceKey1);

        expect(MessageEmitter.postTrigger).toBeCalledTimes(1);
        expect(MessageEmitter.postTrigger).toBeCalledWith(instanceKey1, 'authComplete', {});

        expect(logSuccessResponse).toBeCalledTimes(1);
    });

    it('callback fails if external platform does not generate tokens', async () => {
      const code = 'dummyCode';
      await request
        .get(`${baseUrl}/callback/google`)
        .query({
          state: Buffer.from(instanceKey1).toString('base64'),
          code
        })
        .expect(500)

        expect(GoogleDrive.getTokens).toBeCalledTimes(1);
        expect(GoogleDrive.getTokens).toBeCalledWith(code, instanceKey1);

        expect(InstanceManager.get).toBeCalledTimes(1);
        expect(InstanceManager.get.mock.calls[0][0]).toBe(instanceKey1);

        expect(JsForce.sendTokens).not.toHaveBeenCalled();
        expect(MessageEmitter.postTrigger).not.toHaveBeenCalled();
        expect(logSuccessResponse).not.toHaveBeenCalled();

        expect(logErrorResponse).toHaveBeenCalledTimes(1);
    });
  });
});
