import { baseEnvironment } from './environment.base';

/** Local development (`ng serve`): same backend and Firebase project, local web address. */
export const environment = {
  ...baseEnvironment,
  production: false,
  webBaseUrl: 'http://localhost:4200',
};
