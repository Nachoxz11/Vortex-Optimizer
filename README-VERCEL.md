# Vercel deployment for Vortex-Optimizer updates

1. Install the Vercel CLI:
   ```powershell
   npm install -g vercel
   ```
2. Login to Vercel:
   ```powershell
   vercel login
   ```
3. From the project root, deploy:
   ```powershell
   cd "c:\Users\Ignacio Gonzalez\Desktop\tweaks"
   vercel --prod
   ```
4. Link the local folder to the Vercel project:
   ```powershell
   vercel link
   ```
   Choose the existing Vercel project (or create it). Then open `.vercel/project.json` and copy `orgId` and `projectId`.

5. In GitHub repository settings, go to **Settings → Secrets and variables → Actions → New repository secret** and add:
   - `VERCEL_TOKEN`: create it in Vercel under **Account Settings → Tokens**. Copy it immediately; it is shown only once.
   - `VERCEL_ORG_ID`: the `orgId` from `.vercel/project.json`.
   - `VERCEL_PROJECT_ID`: the `projectId` from `.vercel/project.json`.

   The scheduled workflow uses these secrets to deploy the update endpoint at the same time as the GitHub release. Never commit `.vercel/project.json` or the token.

6. Set the update endpoint environment variable in the app:
   ```powershell
   $env:XTWEAKS_UPDATE_MANIFEST_URL="https://xtweaks-update.vercel.app/api/manifest"
   ```
