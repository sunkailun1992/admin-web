// 浏览器测试用的入口：不含 Node 专用的 msw/node 与读文件（固定数据在浏览器里直接 import JSON）。
export * from './msw-browser.ts';
export * from './render.tsx';
