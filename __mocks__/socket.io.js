// const socket = jest.genMockFromModule('socket.io');
const callbackObject = {
  on: jest.fn(() => {
    return {
      join: jest.fn()
    }
  })
};
// @ts-ignore
const on = jest.fn((_, cb=callbackObject) => cb.on())

const to = jest.fn(() =>{
  return { emit: jest.fn() }
});

module.exports = function() {
  return {
    on,
    to
  }
}