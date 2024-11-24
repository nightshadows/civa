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
