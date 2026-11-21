import { useEffect, useLayoutEffect, useRef } from 'react';

// 浏览器里用 layout effect：提交后、绘制前、早于所有 useEffect 同步；没有 DOM 时（单元测试的服务端渲染）退成
// useEffect，因为 React 18 服务端渲染遇到 useLayoutEffect 会打警告。
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' &&
  typeof window.document?.createElement === 'function'
    ? useLayoutEffect
    : useEffect;

/**
 * 最新值的 ref：每次提交后同步成最新值，给异步回调、事件处理和 effect 读最新的属性或状态。
 * 渲染期不读它（React 文档：渲染期不读写 ref.current，初始化除外）；渲染要用的值直接用 props 或 state。
 */
export function useLatestRef<T>(value: T): { readonly current: T } {
  const ref = useRef(value);
  useIsomorphicLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
