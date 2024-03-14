export const hCaptchaUsed = () => {
  const error = {
    code: '10009',
    title: 'Authentication Error',
    detail:
      'The captcha secret provided has already been used. Please refresh the page and attempt verification once more.',
    meta: {
      code: 401,
      title: 'hCaptcha Token Used',
      detail: 'This hCaptcha token has already been used to generate an API key.',
      message: 'The user will need to regenerate a valid token by completing the hCaptcha process again.',
    },
  };

  console.log(error);
  return error;
};

export const webTokenInvalid = (expiredAt: string) => {
  const error = {
    code: '10009',
    title: 'Authentication Error',
    detail: `The captcha token provided has expired. Please complete the captcha verification process again to generate a new token.`,
    meta: {
      code: 401,
      title: 'JSON Web Token Expired',
      detail: `An expired JSON Web Token was used.`,
      message: `Expired on ${expiredAt}`,
    },
  };

  console.log(error);
  return error;
};

export const webTokenMissing = () => {
  const error = {
    code: '10009',
    title: 'Authentication Error',
    detail: 'There was no API key provided in the request.',
    meta: {
      code: 401,
      title: 'JWT Missing',
      detail: 'JSON Web Token not provided in request.',
      message: 'The user will need to generate a valid token by completing the hCaptcha process.',
    },
  };

  console.log(error);
  return error;
};

export const hCaptchaError = () => {
  const error = {
    code: '10009',
    title: 'Authentication Error',
    detail: 'We were unable to verify the captcha. Please refresh the page and attempt verification once more.',
    meta: {
      code: 401,
      title: 'Validation Error',
      detail: 'The hCaptcha verification middleware returned an error.',
      message: "Either authentication wasn't provided, or an invalid token was used.",
    },
  };

  console.log(error);
  return error;
};
