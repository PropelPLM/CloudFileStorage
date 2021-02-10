const google = require('../api/v0/lib/GoogleDrive');
const data = require('./googleTestData');

jest.mock('googleapis').mock('fs');

it('authorize with correct credentials', async () => {
  const setCredentialsCallback = jest.fn((...args) => {
    return {
      status: data.success_status,
      data: data.file_data,
    };
  });
  const callbackResult = await google.authorize(
    data.client_id,
    data.client_secret,
    data.access_token,
    data.file_name,
    data.mime_type,
    setCredentialsCallback
  );
  expect(setCredentialsCallback).toHaveBeenCalledWith(
    expect.anything(),
    data.file_name,
    data.mime_type
  );
  expect(callbackResult).toEqual(
    expect.objectContaining({
      status: expect.any(Number),
      data: expect.any(String),
    })
  );
});

it('successful upload to drive', async () => {
  const uploadResponse = await google.uploadFile(
    {},
    data.file_name,
    data.mime_type
  );
  expect(uploadResponse).toEqual(
    expect.objectContaining({
      status: 200,
      data: data.file_data,
    })
  );
});

it('failed upload to drive', async () => {
  const uploadResponse = await google.uploadFile({}, null, null);
  expect(uploadResponse).toEqual(
    expect.objectContaining({
      status: 503,
    })
  );
});
