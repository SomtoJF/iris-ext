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
    host_permissions: ['http://localhost:4000/*'],
    optional_host_permissions: ['http://*/*', 'https://*/*'],
    action: {
      default_title: 'Open Iris',
    },
  },
});
