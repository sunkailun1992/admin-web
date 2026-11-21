import type { AppRoute } from '../../config/routes';

export type MenuPage = { path: string; name: string };

/** 菜单页：有名字、有页面组件、进布局的路由，嵌套展开，顺序与路由表一致。重定向与登录失败页不算。 */
export function menuPagesFromRoutes(routes: readonly AppRoute[]): MenuPage[] {
  return routes.flatMap((route) => [
    ...(route.name && route.component && route.path && route.layout !== false
      ? [{ path: route.path, name: route.name }]
      : []),
    ...menuPagesFromRoutes(route.routes ?? []),
  ]);
}
