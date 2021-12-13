// @ts-nocheck
/* eslint-disable no-unused-vars */
const mockAuthedClient = {
  api: jest.fn((endpoint) => mockAuthedClient),
  responseType: jest.fn((option) => mockAuthedClient),
  delete: jest.fn(() => {}),
  put: jest.fn((payload) => {}),
  post: jest.fn((payload) => {
    return {
      headers: {
        get: jest.fn()
      }
    }
  }),
  update: jest.fn((payload) => {}),
  get: jest.fn((payload) => {
    return {
      value: [{
        id: 'test',
        displayName: 'PropelPLM'
      }]
    }
  })
}

export const unwrapped = {
  setCredentials: jest.fn().mockReturnValueOnce({}).mockImplementation(() => { throw new Error() }),
  generateAuthUrl: jest.fn(_ => {
    return 'url';
  }),
  getToken: jest.fn().mockReturnValueOnce({}).mockImplementation(() => { throw new Error() }),
  api: jest.fn((endpoint) => mockAuthedClient),
  responseType: jest.fn((option) => mockAuthedClient),
  delete: jest.fn(() => mockAuthedClient),
  get: jest.fn((payload) => mockAuthedClient),
  put: jest.fn((payload) => mockAuthedClient),
  post: jest.fn((payload) => mockAuthedClient),
  update: jest.fn((payload) => mockAuthedClient)
};

const auth = Object.create(null);
auth.OAuth2 = jest.fn(() => {
  return unwrapped
});

export { auth };
