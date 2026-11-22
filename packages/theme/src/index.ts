import generated from '../dist/tokens.json';
import type { ColorVariable, CssVariable } from './variables.ts';

export { COLOR_VARIABLES, CSS_VARIABLES } from './variables.ts';
export type { ColorVariable, CssVariable } from './variables.ts';

/** 生成的令牌取值（图表、图谱等不走 CSS 的场景用）：浅色含圆角，暗色只有颜色。 */
export const tokens = generated as {
  light: Record<CssVariable, string>;
  dark: Record<ColorVariable, string>;
};
