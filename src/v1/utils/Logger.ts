'use strict';
import { IPlatform } from '../platforms/Platform';
import GoogleDrive from '../platforms/GoogleDrive/GoogleDrive';
import Office365 from '../platforms/Office365/Office365';

export const logSuccessResponse = (response: any, functionName: string) => {
  const logEnding =
    Object.entries(response).length === 0 && response.constructor === Object
      ? ''
      : `: ${JSON.stringify(response)}`;
  console.log(`\x1b[92m${functionName} succeeded \x1b[39m with a response${logEnding}.`);
  return response;
}

export const logErrorResponse = (err: any, functionName: string) => {
  console.log(`\x1b[31m${functionName} failed \x1b[39m due to error: ${JSON.stringify(err)}.`);
  return err;
}

export const logProgressResponse = (fileName: string, src: string, progress: number) => {
  console.log(`[${fileName}][${src}_UPLOAD]: ${progress}`);
}

export const getPlatform = (platform: string): IPlatform => {
  let returnPlatform: IPlatform;
  switch (platform.toLowerCase()) {
    case 'googledrive':
      returnPlatform = GoogleDrive;
      break;
    case 'office365':
      returnPlatform = Office365;
      break;
    default:
      throw new Error('Platform not specified.')
  }
  return returnPlatform;
}
