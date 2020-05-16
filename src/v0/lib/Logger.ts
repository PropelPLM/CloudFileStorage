'use strict';

module.exports = {
  logSuccessResponse: (response: any, functionName: string) => {
    const logEnding =
      Object.entries(response).length === 0 && response.constructor === Object
        ? ''
        : `: ${JSON.stringify(response)}`;
    console.log(`\x1b[92m${functionName} succeeded \x1b[39m with a response${logEnding}.`);
    return response;
  },

  logErrorResponse: (error: any, functionName: string) => {
      console.log(`\x1b[31m${functionName} failed \x1b[39m due to error: ${JSON.stringify(error)}.`);
      return error;
  },
};
