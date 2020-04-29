module.exports = {
  logSuccessResponse: (response, functionName) => {
    const logEnding =
      Object.entries(response).length === 0 && response.constructor === Object
        ? ""
        : `: ${JSON.stringify(response)}`;
    console.log(`${functionName} has succeeded with a response${logEnding}.`);
    return response;
  },

  logErrorResponse: (error, functionName) => {
    console.log(
      `${functionName} has failed due to error: ${JSON.stringify(error)}.`
    );
    return error;
  },
};
