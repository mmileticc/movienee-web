import { baseEnvironment } from './environment.base';

/** Production build. */
export const environment = {
  ...baseEnvironment,
  production: true,
  /** Public address of this web app, used for share links. */
  webBaseUrl: 'https://movienee.web.app',
};
