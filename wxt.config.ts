import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  outDir: 'dist',
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'Iris',
    description: 'AI-assisted job applications',
    permissions: ['sidePanel', 'activeTab', 'scripting', 'tabs', 'storage'],
    host_permissions: ['https://api.applywithiris.com/*'],
    optional_host_permissions: ['http://*/*', 'https://*/*'],
    action: {
      default_title: 'Open Iris',
    },
    version: '0.0.0.4',
  },
});
