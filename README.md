# civa
Civilization Ы

# Running project
Prerequisites on Windows:
 winget install --id GitHub.cli 
 winget install -e --id OpenJS.NodeJS
 Set-ExecutionPolicy -Scope CurrentUser Unrestricted

./shared
   npm install
   npm run build
./server
   npm install
   npm run start

./client
   npm install
   npm run dev


## Deploying to Cloudflare

### Deploying worker server
```
cd server
npx wrangler login
npx wrangler deploy
```

### Deploying client
```
cd client
npm run build:prod
npx wrangler pages publish public
```
