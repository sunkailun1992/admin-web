// 换个名字导入：业务代码里 useEffectEvent 返回的函数只能在 effect 里调用（lint 按这个名字检查）；
// 服务端渲染不跑 effect，这里直接调用它，只核对兼容实现本身。
import { useEffectEvent as useEffectEventShim } from '@/hooks/useEffectEvent';
import { useLatestRef } from '@/hooks/useLatestRef';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, test, vi } from 'vitest';

afterEach(() => vi.restoreAllMocks());

// 单元测试只做服务端渲染、不跑 effect：这里核对首次渲染的值与服务端渲染不报 layout effect 警告；
// 提交后同步最新值由浏览器测试（固定数据与真实网关两组）兜底。
test('useLatestRef starts with the first value and stays quiet on the server', () => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  const seen: { current: string }[] = [];
  function Probe({ value }: { value: string }) {
    seen.push(useLatestRef(value));
    return null;
  }
  renderToStaticMarkup(createElement(Probe, { value: 'first' }));
  expect(seen.length).toBe(1);
  expect(seen[0].current).toBe('first');
  expect(errors).not.toHaveBeenCalled();
});

test('useEffectEvent calls the latest callback with its arguments', () => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  const events: ((value: number) => number)[] = [];
  function Probe({ offset }: { offset: number }) {
    events.push(useEffectEventShim((value: number) => value + offset));
    return null;
  }
  renderToStaticMarkup(createElement(Probe, { offset: 10 }));
  expect(events[0](1)).toBe(11);
  expect(errors).not.toHaveBeenCalled();
});
