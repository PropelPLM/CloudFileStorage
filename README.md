Last edited: 4th March' 21
For local dev, make a `.env` file at the base of this git subdir, i.e. `/externalFileStorage` and run `npm run dev` in the subdirectory.
As of time of writing, the `.env` file should minimally specify the following variables:
  - platform (only working for `Office365` as of time of writing)
  - clientId
  - clientSecret
  - salesforceUrl
  - tenantId
  - destinationFolderId

With that setup, use postman to hit endpoints on `localhost:3030`.
Parameters in the SF request body can be 'mocked' in Body > Raw in `JSON` format.
