

// const MessageEmitter = jest.genMockFromModule("../../src/v0/utils/MessageEmitter") as any;
const InstanceManager = jest.mock("../InstanceManager") as any;

import { unwrapped } from '../../../../__mocks__/helperObjects/OAuth';
import { ptObject } from '../../../../__mocks__/helperObjects/PassThrough';
import { JsConnection } from '../../../../__mocks__/helperObjects/JsConnection';
const data = require('../../__tests__/data/mockData.json')

InstanceManager.upsert = jest.fn((key, payload) => {
    const copy = data.instanceMap[key];
    return Object.assign({}, copy, payload)
})
InstanceManager.get = jest.fn(key => {
    const state = data.instanceMap[key];
    state.oAuth2Client = unwrapped;
    state.uploadStream = ptObject;
    state.connection = JsConnection;
    return state;
})

export default InstanceManager;
