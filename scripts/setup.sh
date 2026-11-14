#!/bin/sh
# One-time setup. Run from the project root:  npm run setup
# Installs the latest stable version of each package and records the resolved
# versions in package.json and package-lock.json. Commit both afterwards.
set -e

if [ -z "$(command -v node)" ]; then echo "Node 22 or newer is required."; exit 1; fi

npm install \
  react react-dom \
  react-aria-components \
  @fontsource-variable/figtree \
  @fontsource-variable/fredoka

npm install -D \
  vite @vitejs/plugin-react \
  typescript @types/react @types/react-dom @types/node \
  tailwindcss @tailwindcss/vite \
  vite-plugin-pwa \
  vitest \
  @playwright/test \
  eslint @eslint/js typescript-eslint eslint-plugin-react-hooks globals \
  prettier prettier-plugin-tailwindcss

# Browser used by the end-to-end tests
npx playwright install chromium

echo
echo "Done. Next: npm run format && npm run lint && npm run typecheck && npm test && npm run test:e2e"
echo "(npm run format reformats the starter files once to match the Prettier settings.)"
