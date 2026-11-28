import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.homeshelfie.shelfie',
  appName: 'homeshelfie',
  // The native build (npm run build:native): relative asset paths, no PWA. See vite.config.ts.
  webDir: 'dist/native',
}

export default config
