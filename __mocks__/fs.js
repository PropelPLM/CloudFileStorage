const fs = jest.genMockFromModule("fs");

const FAKE_FILE_SIZE = 1024;
const FAKE_STREAM = Object.create(null);

statSync = jest.fn((stats) => {
  return {
    size: FAKE_FILE_SIZE,
  };
});

pipe = jest.fn((FAKE_STREAM) => {
  return {
    pipe: pipe,
  };
});

fs.createReadStream = jest.fn(() => {
  return pipe(FAKE_STREAM);
});

fs.pipe = pipe;
fs.statSync = statSync;

module.exports = fs;
