// sleep
export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const removeQuote = (str: string) => {
  return str.replace(/['"]+/g, '');
};

export const decodeBase64 = (str: string) => {
  return Buffer.from(str, 'base64').toString('hex');
};
