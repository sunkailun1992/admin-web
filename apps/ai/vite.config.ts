import { defineAppConfig } from '@admin-web/config-vite';

export default defineAppConfig({
  name: 'ai',
  role: 'remote',
  devPort: 8103,
  previewPort: 8203,
  exposes: { './routes': './src/routes.tsx' },
});
