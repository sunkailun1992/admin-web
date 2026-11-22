import { defineAppConfig } from '@admin-web/config-vite';

export default defineAppConfig({
  name: 'system',
  role: 'remote',
  devPort: 8101,
  previewPort: 8201,
  exposes: { './routes': './src/routes.tsx' },
});
