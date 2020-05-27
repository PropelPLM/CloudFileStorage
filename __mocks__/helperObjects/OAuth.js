export const unwrapped = {
  setCredentials: jest.fn().mockReturnValueOnce({}).mockImplementation(() => { throw new Error() }),
  generateAuthUrl: jest.fn(_ => {
    return 'url';
  }),
  getToken: jest.fn().mockReturnValueOnce({}).mockImplementation(() => { throw new Error() })
};

const auth = Object.create(null);
auth.OAuth2 = jest.fn(() => {
  return unwrapped
});

export { auth };
