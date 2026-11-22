// 浏览器测试里把动画与过渡快进到结束（与 Playwright 截图时 animations: 'disabled' 的做法相同）：
// 弹层淡入从透明度 0 开始，“可见”断言与无障碍对比度检查都会与动画赛跑，结果随时序变化。
const style = document.createElement('style');
style.dataset.test = 'no-motion';
style.textContent = `*, *::before, *::after {
  animation-duration: 0s !important;
  animation-delay: 0s !important;
  transition-duration: 0s !important;
  transition-delay: 0s !important;
}`;
document.head.append(style);
