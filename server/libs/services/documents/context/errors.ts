export const DownstreamError = (detail: string, message?: string) => {
  const error = {
    code: '10037',
    title: 'Internal Server Error',
    detail: 'A downstream service is experiencing issues. Please try again shortly.',
    meta: {
      code: 500,
      title: 'Internal Server Error',
      detail,
      message: typeof message !== 'string' ? JSON.stringify(message) : message,
    },
  };

  console.log(error);
  return error;
};
