declare const process: {
  env: {
    WS_URL: string;
    API_URL: string;
  };
};

export const config = {
  wsUrl: process.env.WS_URL || 'ws://localhost:3000/api',
  apiUrl: process.env.API_URL || 'http://localhost:3000/api'
};
