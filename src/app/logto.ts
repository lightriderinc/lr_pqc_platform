export const logtoConfig = {
  endpoint: process.env.LOGTO_ENDPOINT as string,
  appId: process.env.LOGTO_APP_ID as string,
  appSecret: process.env.LOGTO_APP_SECRET as string,
  baseUrl: process.env.NEXT_BASE_URL || 'http://localhost:3000',
  cookieSecret: process.env.LOGTO_COOKIE_SECRET as string,
  cookieSecure: process.env.NODE_ENV === 'production',
  scopes: ['email', 'profile'],
};
