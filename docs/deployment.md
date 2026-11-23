# Deployment and verification

The normal Next.js build requires a Node.js server for dynamic routes, authentication and API endpoints. Deploy it to a Node-compatible host using `npm ci`, `npm run build`, then `npm start`; configure runtime secrets as described in `.env.example`. GitHub Pages is static hosting and cannot run those endpoints. The application currently uses root-relative URLs and the desktop export deliberately disables server routes and enables native desktop behavior, so publishing that export to a Pages project subpath is not a supported web deployment. Do not use it as a drop-in Pages deployment.

`npm run build:desktop` creates a separate static export in `out/` for Tauri; it does not modify the web sources. The Windows workflow builds and tests the native shell and fetches Microsoft's fixed WebView2 runtime during CI rather than committing the runtime to the repository.

CI checks lint, types, production and desktop builds, production dependency advisories and the measurement comparison UI on desktop and mobile viewports. Local browser tests require a Playwright Chromium installation (`npx playwright install chromium`). `npm audit` also reports a moderate development-only advisory through drizzle-kit; it is not included in the production dependency tree and requires an upstream-compatible fix.
