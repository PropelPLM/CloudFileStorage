// @ts-nocheck
// TODO: find another way to enforce type safety OR get ts to realise this is a jest file
import { logErrorResponse, logSuccessResponse } from '../../utils/Logger';
import InstanceManager from '../../utils/InstanceManager';
import MessageEmitter from '../../utils/MessageEmitter';
import data from '../data/mockData.json';
const io = require('socket.io')();

jest
  .mock('socket.io')
  .mock('../../utils/Logger')
  .mock('../../utils/InstanceManager')

const instanceKey1 = data.instanceKey1;

describe ('MessageEmittertest suite', () => {

  afterEach(() => {
    jest.clearAllMocks();
  });

  it ('init to be called on connection', () => {
    MessageEmitter.init();
    expect(io.on).toHaveBeenCalled();
    expect(io.on.mock.calls[0][0]).toBe('connection');
  })

  it('postTrigger causes io to emit a trigger event', () => {
    const dummyTopic = 'dummyTopic';
    const dummyPayload = 'dummyPayload'
    MessageEmitter.postTrigger(instanceKey1, dummyTopic, dummyPayload);

    expect(logSuccessResponse).toHaveBeenCalledTimes(1);
    expect(io.to).toHaveBeenCalledTimes(1);
    expect(io.to).toHaveBeenCalledWith(instanceKey1);
    expect(io.to.mock.results[0].value.emit).toHaveBeenCalledTimes(1);
    expect(io.to.mock.results[0].value.emit).toHaveBeenCalledWith('trigger', { topic: dummyTopic, payload: dummyPayload });
  });

  it('postProgress causes io to emit a progress event', () => {
    MessageEmitter.postProgress(instanceKey1, 'FRONTEND');

    expect(InstanceManager.get).toHaveBeenCalledTimes(1);
    expect(io.to).toHaveBeenCalledTimes(1);
    expect(io.to).toHaveBeenCalledWith(instanceKey1);
    expect(io.to.mock.results[0].value.emit).toHaveBeenCalledTimes(1);
    expect(io.to.mock.results[0].value.emit.mock.calls[0][0]).toBe('progress');
  });

  it('setAttribute causes io to emit a progress event', () => {
    const attribute = 'dummyAttribute';
    const value = 'dummyValue';
    MessageEmitter.setAttribute(instanceKey1, attribute, value);

    expect(io.to).toHaveBeenCalledTimes(1);
    expect(io.to).toHaveBeenCalledWith(instanceKey1);
    expect(io.to.mock.results[0].value.emit).toHaveBeenCalledTimes(1);
    const payload = {};
    payload['instance-key'] = instanceKey1;
    payload[attribute] = value;
    expect(io.to.mock.results[0].value.emit).toHaveBeenCalledWith('setAttribute', payload);
  });

});
