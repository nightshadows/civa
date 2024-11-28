# civa
Civilization Ы

# Running project
Prerequisites on Windows:
 winget install --id GitHub.cli 
 winget install -e --id OpenJS.NodeJS
 Set-ExecutionPolicy -Scope CurrentUser Unrestricted


Prerequisites on Macos:
 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
 brew install node; brew install npm

./server
   npm install
   npm run start

./client
   npm install
   npm run build
   npm run dev


## Deploying to Cloudflare

Current deployment runs at: https://civa-5ls.pages.dev/

To deploy you need to be logged in to wrangler cli:
```
npx wrangler login
```

### Deploying worker server
```
cd server
npm run release:cloudflare
```

To debug worker server:
```
npm run dev:cloudflare
```

To reset worker server:
```
curl https://game-server.bestander.workers.dev/reset
```

### Deploying client
```
cd client
npm run release:cloudflare
```
