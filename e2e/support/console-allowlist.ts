export type AllowlistEntry = {
  pattern: RegExp;
  /** 消息来自哪个第三方库、哪个版本。 */
  source: string;
  /** 'part2'：第二部分升级后应消失；否则写上游 issue 的 https 链接。 */
  until: 'part2' | string;
};

/**
 * 浏览器测试的控制台允许清单，默认空。只收能证明来自第三方的消息，本项目代码打出的错误与警告一律改掉。
 * 页面错误（pageerror）不进清单。
 */
export const consoleAllowlist: AllowlistEntry[] = [
  {
    pattern: /^Warning: findDOMNode is deprecated[\s\S]*at ListToolBar/,
    source:
      '@ant-design/pro-components 2.8.10 的 ProTable 工具栏：ListToolBar 里的 Tooltip 经 rc-resize-observer 调 findDOMNode，React 18.3 打弃用提示',
    until: 'part2',
  },
  {
    pattern:
      /^Warning: \[antd: TreeSelect\] `onDropdownVisibleChange` is deprecated\./,
    source:
      '@ant-design/pro-components 2.8.10 带的 @ant-design/pro-field 3.1.0：FieldTreeSelect（es/components/TreeSelect/index.js 第 133、210 行）总给 antd TreeSelect 传 onDropdownVisibleChange，antd 5.29 打弃用提示；本项目代码不传',
    until: 'part2',
  },
  {
    pattern: /^Warning: \[antd: TreeSelect\] `bordered` is deprecated\./,
    source:
      '@ant-design/pro-components 2.8.10 带的 @ant-design/pro-field 3.1.0：FieldTreeSelect（同一文件第 156、212 行）总给 antd TreeSelect 传 bordered，antd 5.29 打弃用提示；本项目代码不传',
    until: 'part2',
  },
];

export function assertAllowlistValid(entries: readonly AllowlistEntry[]): void {
  for (const entry of entries) {
    if (!entry.source.trim())
      throw new Error(`控制台允许清单缺少来源：${entry.pattern}`);
    if (entry.until !== 'part2' && !/^https:\/\/\S+$/.test(entry.until))
      throw new Error(`控制台允许清单缺少结束条件：${entry.pattern}`);
  }
}
