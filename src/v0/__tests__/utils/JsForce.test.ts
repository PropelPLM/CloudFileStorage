// @ts-nocheck
// TODO: find another way to enforce type safety OR get ts to realise this is a jest file
import jsConnect from 'jsforce';
import JsForce from '../../utils/JsForce';
import { logErrorResponse, logSuccessResponse } from '../../utils/Logger';
import InstanceManager from '../../utils/InstanceManager';
import data from '../data/mockData.json';
import "../../../../jest.extend";

jest
  .mock('jsforce')
  .mock('../../utils/Logger')
  .mock('../../utils/MessageEmitter')
  .mock('../../utils/InstanceManager');

const instanceMap: Record<string, Partial<IMap>> = data.instanceMap;
const instanceKey1 = data.instanceKey1;
const instanceKey2 = data.instanceKey2;

xdescribe ('JsForce test suite', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('connection setup', () => {
    it('connect establishes connection to SF Apex', async () => {
      const sessionId = instanceMap[instanceKey1].sessionId;
      const salesforceUrl = instanceMap[instanceKey1].salesforceUrl;
      await JsForce.connect(sessionId, salesforceUrl, instanceKey1);

      expect(Object.values(jsConnect.Connection.mock.calls[0][0]))
        .toEqual(expect.arrayContaining([sessionId, salesforceUrl]));
      expect(InstanceManager.upsert).toHaveBeenCalledTimes(2);
      expect(logSuccessResponse).toHaveBeenCalledTimes(2);
    });
    
    it('connect sets up namespace', () => {
      const sessionId = instanceMap[instanceKey1].sessionId;
      const salesforceUrl = instanceMap[instanceKey1].salesforceUrl;
      const spy = jest.spyOn(JsForce, 'setupNamespace');
      JsForce.connect(sessionId, salesforceUrl, instanceKey1);

      expect(JsForce.setupNamespace).toHaveBeenCalledTimes(1);
      expect(JsForce.setupNamespace).toHaveBeenCalledWith(instanceKey1);
    });
  });

  describe('utils', () => {
    it('setupNamespace does a callout to query SF Apex', async () => {
      await JsForce.setupNamespace(instanceKey1);

      expect(InstanceManager.upsert).toBeCalledTimes(1);
      expect(InstanceManager.get).toHaveBeenCalledTimes(1);
      expect(logSuccessResponse).toHaveBeenCalledTimes(1);
      expect(InstanceManager.get.mock.results[0].value.connection.query).toBeCalledTimes(1);
    });

    it('addNamespace prefixes objects with org namespace', async () => {
      const obj = {};
      const properties = ['a', '_','*', '/', '\\', '']
        .forEach(prop => Object.defineProperty(obj, prop, {}));
      const namespaced = await JsForce.addNamespace(obj, instanceKey1);

      const namespace = instanceMap[instanceKey1].orgNamespace;
      const namespacedProperties = Object.keys(namespaced);
      for (let i in properties) expect(namespacedProperties[i]).stringContaining(namespace);
      expect(InstanceManager.get).toHaveBeenCalledTimes(1);
    });
  });

  it('sendTokens writes correct tokens to SF Apex', async () => {
    const settings = {
      access_token: data.accessToken,
      refresh_token: data.refreshToken,
      expiry_date: data.expiryDate,
      clientId: instanceMap[instanceKey1].clientId,
      clientSecret : instanceMap[instanceKey1].clientSecret
    }
    await JsForce.sendTokens(settings, instanceKey1);
    expect(InstanceManager.get).toHaveBeenCalledTimes(2); //addnamespace does call
    expect(logSuccessResponse).toBeCalledTimes(1);
    expect(InstanceManager.get.mock.results[0].value.connection.sobject).toBeCalledTimes(1);

    const namespace = instanceMap[instanceKey1].orgNamespace;
    expect(InstanceManager.get.mock.results[0].value.connection.sobject).toBeCalledWith(`${namespace}__Cloud_Storage__c`);
    expect(InstanceManager.get.mock.results[0].value.connection.sobject.mock.results[0].value.upsert.mock.calls[0][0]).toBeType('object');
    expect(InstanceManager.get.mock.results[0].value.connection.sobject.mock.results[0].value.upsert.mock.calls[0][1]).toBe(`${namespace}__Client_Id__c`);
  });

  describe('create triggers item creation on SF Apex', () => {
    it('writes to existing object', async () => {
      const file = {
        name: instanceMap[instanceKey1].file.name,
        webViewLink: instanceMap[instanceKey1].file.webViewLink,
        id: instanceMap[instanceKey1].file.id,
        fileExtension: instanceMap[instanceKey1].file.fileExtension,
        webContentLink: instanceMap[instanceKey1].file.webContentLink
      };
      await JsForce.create(file, instanceKey1);

      expect(InstanceManager.get).toHaveBeenCalledTimes(2); //addnamespace does call
      expect(logSuccessResponse).toBeCalledTimes(1);
      expect(InstanceManager.get.mock.results[0].value.connection.sobject).toBeCalledTimes(1);

      const namespace = instanceMap[instanceKey1].orgNamespace;
      expect(InstanceManager.get.mock.results[0].value.connection.sobject).toBeCalledWith(`${namespace}__Document__c`);
      
      expect(InstanceManager.get.mock.results[0].value.connection.sobject.mock.results[0].value.create.mock.calls[0][0]).toBeType('object');
      const itemRev = {};
      itemRev[`${namespace}__Item_Revision__c`] = instanceMap[instanceKey1].revisionId;
      expect(InstanceManager.get.mock.results[0].value.connection.sobject.mock.results[0].value.create.mock.calls[0][0])
        .toMatchObject({
          Name: instanceMap[instanceKey1].file.name,
          ...itemRev
        });
    });

    it('writes to new object', async () => {
      const file = {
        name: instanceMap[instanceKey2].file.name,
        webViewLink: instanceMap[instanceKey2].file.webViewLink,
        id: instanceMap[instanceKey2].file.id,
        fileExtension: instanceMap[instanceKey2].file.fileExtension,
        webContentLink: instanceMap[instanceKey2].file.webContentLink
      }
      await JsForce.create(file, instanceKey2);

      const namespace = instanceMap[instanceKey2].orgNamespace;
      const itemRev = {};
      itemRev[`${namespace}__Item_Revision__c`] = instanceMap[instanceKey2].revisionId;
      expect(InstanceManager.get.mock.results[0].value.connection.sobject.mock.results[0].value.create.mock.calls[0][0])
        .not.toMatchObject({
          Name: instanceMap[instanceKey2].file.name,
          ...itemRev
        });
    });
  });

});
