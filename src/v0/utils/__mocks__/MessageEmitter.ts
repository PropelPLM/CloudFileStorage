// const MessageEmitter = jest.genMockFromModule("../../src/v0/utils/MessageEmitter") as any;
const MessageEmitter = jest.mock("../MessageEmitter") as any;

MessageEmitter.postProgress = jest.fn()
MessageEmitter.postTrigger = jest.fn()
MessageEmitter.setAttribute = jest.fn()
MessageEmitter.io = {on: jest.fn()}

export default MessageEmitter;
