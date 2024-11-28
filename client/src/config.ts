declare const process: {
  env: {
    WS_URL: string;
  };
};

export const config = {
  wsUrl: process.env.WS_URL || 'ws://localhost:3000'
}; 