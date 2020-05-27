import { auth } from './helperObjects/OAuth';
const { google } = jest.genMockFromModule('googleapis');

const drive = jest.fn(() => {
  return {
    files: {
      create: jest.fn().mockReturnValue({})
    },
  };
});

google.auth = auth;
google.drive = drive;

export { google };
