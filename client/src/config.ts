declare const process: {
  env: {
    WS_URL: string;
    API_URL: string;
  };
};

export const config = {
  wsUrl: process.env.WS_URL || 'ws://localhost:3000',
  apiUrl: process.env.API_URL || 'http://localhost:3000'
};
