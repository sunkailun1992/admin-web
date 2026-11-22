/** shadcn/ui 的颜色变量（浅色与暗色各声明一遍）。 */
export const COLOR_VARIABLES = [
  '--background',
  '--foreground',
  '--card',
  '--card-foreground',
  '--popover',
  '--popover-foreground',
  '--primary',
  '--primary-foreground',
  '--secondary',
  '--secondary-foreground',
  '--muted',
  '--muted-foreground',
  '--accent',
  '--accent-foreground',
  '--destructive',
  '--border',
  '--input',
  '--ring',
  '--chart-1',
  '--chart-2',
  '--chart-3',
  '--chart-4',
  '--chart-5',
  '--sidebar',
  '--sidebar-foreground',
  '--sidebar-primary',
  '--sidebar-primary-foreground',
  '--sidebar-accent',
  '--sidebar-accent-foreground',
  '--sidebar-border',
  '--sidebar-ring',
] as const;

/** 主题包声明的全部变量：颜色加圆角（圆角只在 :root 声明一次）。 */
export const CSS_VARIABLES = [...COLOR_VARIABLES, '--radius'] as const;

export type ColorVariable = (typeof COLOR_VARIABLES)[number];
export type CssVariable = (typeof CSS_VARIABLES)[number];
