import { configure } from '@testing-library/react';
import { ASYNC_UTIL_TIMEOUT } from './index.ts';

// 在各包 Vitest 的 setupFiles 里最先引入：findBy*、waitFor 默认等 ASYNC_UTIL_TIMEOUT（原因见 index.ts）。
configure({ asyncUtilTimeout: ASYNC_UTIL_TIMEOUT });
