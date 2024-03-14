export const MissingParameters = (required: string[], passed: string[]) => {
  const error = {
    code: '10015',
    title: 'Bad Request',
    detail: 'The request failed because it was not well-formed.',
    meta: {
      code: 400,
      title: 'Invalid Query Parameters',
      detail: 'The request is missing required parameters.',
      message: `Required: (${required}) -> Passed: (${passed}).`,
    },
  };

  console.log(error);
  return error;
};

export const MissingBodyParameters = (required: string[], passed: string[]) => {
  const error = {
    code: '10015',
    title: 'Bad Request',
    detail: 'The request failed because it was not well-formed.',
    meta: {
      code: 400,
      title: 'Invalid Body Parameters',
      detail: 'The request is missing required body parameters.',
      message: `Required: (${required}) -> Passed: (${passed}).`,
    },
  };

  console.log(error);
  return error;
};

export const Unexpected = (detail: string, message?: string) => {
  const error = {
    code: '10007',
    title: 'Unexpected Error',
    detail: 'An unexpected error occured.',
    meta: {
      code: 400,
      title: 'Internal Server Error',
      detail,
      message: message || 'No error message.',
    },
  };

  console.log(error);
  return error;
};

export const BadRequest = (title: string, detail: string, message?: string) => {
  const error = {
    code: '10015',
    title: 'Bad Request',
    detail: 'The request failed because it was not well-formed.',
    meta: {
      code: 400,
      title,
      detail,
      message: message || 'No error message.',
    },
  };

  console.log(error);
  return error;
};
