export const OpenAIError = (detail: string, message?: string) => {
  const error = {
    code: '10037',
    title: 'Internal Server Error',
    detail:
      'There was a problem connecting to the Open AI service. Please check for outages at [status.openai.com](https://status.openai.com).',
    meta: {
      code: 500,
      title: 'Internal Server Error',
      detail,
      message: message || 'No error message.',
    },
  };

  console.log(error);
  return error;
};

export const OpenAIFunctionError = (detail: string, message?: string) => {
  const error = {
    code: '10037',
    title: 'Internal Server Error',
    detail:
      'There was a problem parsing the response from Open AI. This is likely a temporary issue, please try again shortly.',
    meta: {
      code: 500,
      title: 'Internal Server Error',
      detail,
      message: message || 'No error message.',
    },
  };

  console.log(error);
  return error;
};
