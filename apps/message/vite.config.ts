import { defineAppConfig } from '@admin-web/config-vite';

export default defineAppConfig({
  name: 'message',
  role: 'remote',
  devPort: 8102,
  previewPort: 8202,
  exposes: { './routes': './src/routes.tsx', './Bell': './src/Bell.tsx' },
});
