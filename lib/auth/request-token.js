/* eslint-disable @typescript-eslint/no-require-imports */
const { getToken } = require("next-auth/jwt");

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

  if (!secret) {
    throw new Error("AUTH_SECRET or NEXTAUTH_SECRET is required");
  }

  return secret;
}

async function getRequestAuthToken(req) {
  return getToken({
    req,
    secret: getAuthSecret(),
  });
}

module.exports = {
  getRequestAuthToken,
};
