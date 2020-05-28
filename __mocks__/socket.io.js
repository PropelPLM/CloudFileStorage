// const socket = jest.genMockFromModule('socket.io');
const on = jest.fn();

const to = jest.fn(() =>{
  return { emit: jest.fn() }
});

module.exports = function() {
  return {
    on,
    to
  }
}