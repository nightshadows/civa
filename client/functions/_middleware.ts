 // @ts-ignore only used in cloudflare production
 export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  
  // Forward all /api requests (both REST and WebSocket) to the Worker
  if (url.pathname.startsWith('/api')) {
    const workerUrl = `https://game-server.bestander.workers.dev${url.pathname}`;
    
    // Create headers for the worker request
    const headers = new Headers(context.request.headers);
    headers.set('Host', 'game-server.bestander.workers.dev');
    
    // Forward the request to the worker
    return fetch(workerUrl, {
      method: context.request.method,
      headers,
      body: context.request.body,
      // @ts-ignore only used in cloudflare production
      duplex: 'half' // Required for WebSocket upgrade requests
    });
  }

  return context.next();
};