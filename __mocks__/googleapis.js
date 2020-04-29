const { google } = jest.genMockFromModule("googleapis");

const auth = Object.create(null);
auth.OAuth2 = jest.fn((clientid, clientsecret, redirecturi) => {
  return {
    setCredentials: jest.fn((tokens) => {
      return true;
    }),
  };
});

const drive = jest.fn((version, auth) => {
  return {
    files: {
      create: jest.fn((file) => {
        return new Promise((resolve, reject) => {
          file.resource.name
            ? resolve({
                status: 200,
                data: "hello_test_data",
              })
            : reject({
                status: 503,
              });
        });
      }),
    },
  };
});

google.auth = auth;
google.drive = drive;

module.exports = { google };
