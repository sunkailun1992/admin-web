import { defineAppConfig } from '@admin-web/config-vite';

export default defineAppConfig({
  name: 'rag',
  role: 'remote',
  devPort: 8104,
  previewPort: 8204,
  exposes: { './routes': './src/routes.tsx' },
});
