'use strict';
import { StoragePlatform } from '../platforms/StoragePlatform';
import { GoogleDrive } from '../platforms/GoogleDrive/GoogleDrive';
import { Office365 } from '../platforms/Office365/Office365';
import { AWS } from '../platforms/AWS/AWS';

export const logSuccessResponse = (response: any, functionName: string) => {
  const logEnding =
    Object.entries(response).length === 0 && response.constructor === Object
      ? ''
      : `: ${JSON.stringify(response)}`;
  console.log(`\x1b[92m${functionName} succeeded \x1b[39m with a response${logEnding}.`);
  return response;
}

export const logErrorResponse = (err: any, functionName: string) => {
  console.log(`\x1b[31m${functionName} failed \x1b[39m due to error: ${err.message}.`);
  return err;
}

export const logProgressResponse = (fileName: string, src: string, progress: number) => {
  console.log(`[${fileName}][${src}_UPLOAD]: ${progress}`);
}

export const getPlatform = async (platform: string, instanceKey: string): Promise<StoragePlatform> => {
  let returnPlatform: StoragePlatform;
  switch (platform.toLowerCase()) {
    case 'googledrive':
      returnPlatform = await GoogleDrive.authorize(instanceKey);
      break;
    case 'office365':
      returnPlatform = await Office365.authorize(instanceKey);
      break;
    case 'aws':
      returnPlatform = await AWS.authorize(instanceKey);
      break;
    default:
      throw new Error('Platform not specified.')
  }
  return returnPlatform;
}
