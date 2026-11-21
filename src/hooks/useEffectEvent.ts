import { useCallback } from 'react';
import { useLatestRef } from './useLatestRef';

/**
 * React 19.2 起官方 useEffectEvent 的兼容实现（React 18.3 还没有）：返回的函数总调用最新一次渲染的回调，
 * 只在 effect 里调用、不放进依赖数组。名字与官方一致，eslint-plugin-react-hooks 按同名 Hook 检查用法；
 * 升到 React 19 后改为从 react 导入并删掉本文件。
 */
export function useEffectEvent<Args extends unknown[], Result>(
  callback: (...args: Args) => Result,
) {
  const latest = useLatestRef(callback);
  return useCallback((...args: Args) => latest.current(...args), [latest]);
}
