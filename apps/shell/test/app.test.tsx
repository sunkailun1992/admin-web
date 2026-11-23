import type { RemoteRoutes } from '@admin-web/auth';
import { setupMswWorker } from '@admin-web/test-utils/browser';
import { useQuery } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18next from 'i18next';
import { http, HttpResponse } from 'msw';
import { beforeAll, expect, test, vi } from 'vitest';
import type { RemoteApp } from '../src/remotes/registry.ts';
import { useShell } from '../src/shell.ts';
import { manager, renderApp } from './support.tsx';

const worker = setupMswWorker();

// 子应用的文案在各自的命名空间里（任务9–12 补），这里先放几条测试用的。
beforeAll(() => {
  i18next.addResourceBundle(
    'zh-CN',
    'system',
    { menu: { group: '系统管理', tenant: '租户管理' } },
    true,
    true,
  );
  i18next.addResourceBundle(
    'zh-CN',
    'rag',
    { menu: { group: 'RAG知识库', graph: '知识图谱' } },
    true,
    true,
  );
});

const rag: RemoteRoutes = {
  routes: [{ path: '/rag-knowledge/graph', element: <p>GRAPH_PAGE</p> }],
  menu: [
    {
      path: '/rag-knowledge/graph',
      labelKey: 'rag:menu.graph',
      access: 'canSeeRagGraph',
      group: { key: 'rag', labelKey: 'rag:menu.group' },
    },
  ],
};
const systemRoutes: RemoteRoutes = {
  routes: [{ path: '/system/tenant', element: <p>TENANT_PAGE</p> }],
  menu: [
    {
      path: '/system/tenant',
      labelKey: 'system:menu.tenant',
      access: 'canSeeTenant',
      group: { key: 'system', labelKey: 'system:menu.group' },
    },
  ],
};
const apps: RemoteApp[] = [
  {
    name: 'system',
    entry: 'http://localhost:8101/mf-manifest.json',
    routePrefixes: ['/system'],
  },
  {
    name: 'rag',
    entry: 'http://localhost:8104/mf-manifest.json',
    routePrefixes: ['/rag-knowledge'],
  },
];

/** 远程模块加载：rag 正常；system 按 systemUp 决定能不能加载（模拟停服与恢复）。 */
function remoteModules(state: { systemUp: boolean }) {
  return vi.fn(async (id: string) => {
    if (id === 'rag/routes') return { default: rag };
    if (id === 'system/routes' && state.systemUp)
      return { default: systemRoutes };
    throw new Error(`${id} is down`);
  });
}

const resourcesFor = (tenantId: string) => ({
  success: true,
  data: {
    userId: 'u1',
    username: 'manager',
    nickname: '管理员甲',
    tenantId,
    permissions: manager.currentUser!.permissions,
    availableTenants: manager.availableTenants,
    frontendResources: manager.currentUser!.frontendResources,
    backendResources: manager.currentUser!.backendResources,
  },
});

test('remote load failure only disables its own domain', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  renderApp({
    apps,
    loadModule: remoteModules({ systemUp: false }),
    session: manager,
    route: '/system/tenant',
  });
  const main = screen.getByRole('main');
  expect(await within(main).findByText('系统管理暂时无法加载')).toBeVisible();
  expect(within(main).getByRole('button', { name: '重试' })).toBeVisible();
  const navigation = screen.getByRole('navigation', { name: '主菜单' });
  expect(
    within(navigation).getByRole('button', { name: '系统管理' }),
  ).toHaveAttribute('aria-disabled', 'true');
  await userEvent.click(
    within(navigation).getByRole('link', { name: '知识图谱' }),
  );
  expect(await within(main).findByText('GRAPH_PAGE')).toBeVisible();
});

test('retrying a failed remote loads its routes and menu', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const state = { systemUp: false };
  const loadModule = remoteModules(state);
  renderApp({ apps, session: manager, route: '/system/tenant', loadModule });
  const main = screen.getByRole('main');
  const retry = await within(main).findByRole('button', { name: '重试' });
  state.systemUp = true;
  await userEvent.click(retry);
  expect(await within(main).findByText('TENANT_PAGE')).toBeVisible();
  expect(loadModule).toHaveBeenCalledWith('system/routes');
  const navigation = screen.getByRole('navigation', { name: '主菜单' });
  expect(
    within(navigation).getByRole('link', { name: '租户管理' }),
  ).toBeVisible();
});

test('a remote that is still loading keeps only its own domain waiting', async () => {
  const loadModule = vi.fn((id: string) =>
    id === 'system/routes'
      ? new Promise<never>(() => {})
      : id === 'rag/routes'
        ? Promise.resolve({ default: rag })
        : Promise.reject(new Error(id)),
  );
  vi.spyOn(console, 'error').mockImplementation(() => {});
  renderApp({ apps, loadModule, session: manager, route: '/system/tenant' });
  const main = screen.getByRole('main');
  // 布局与其它域不等它：system 的页面区域显示加载中，菜单里它的占位不可点。
  expect(await within(main).findByText('正在加载系统管理…')).toBeVisible();
  const navigation = screen.getByRole('navigation', { name: '主菜单' });
  expect(
    within(navigation).getByRole('button', { name: '系统管理' }),
  ).toHaveAttribute('aria-disabled', 'true');
  await userEvent.click(
    await within(navigation).findByRole('link', { name: '知识图谱' }),
  );
  expect(await within(main).findByText('GRAPH_PAGE')).toBeVisible();
});

test('an unreadable apps.json offers a retry instead of "not found"', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  let attempts = 0;
  const registry = () => {
    attempts += 1;
    return attempts === 1
      ? Promise.reject(new Error('apps.json unreachable'))
      : Promise.resolve(apps);
  };
  renderApp({
    registry,
    loadModule: remoteModules({ systemUp: false }),
    session: manager,
    route: '/rag-knowledge/graph',
  });
  const main = screen.getByRole('main');
  expect(await within(main).findByText('子应用清单暂时无法读取')).toBeVisible();
  expect(within(main).queryByText('页面不存在')).toBeNull();
  await userEvent.click(within(main).getByRole('button', { name: '重试' }));
  expect(await within(main).findByText('GRAPH_PAGE')).toBeVisible();
  expect(attempts).toBe(2);
});

test('switching tenant clears the shared query cache', async () => {
  let seenTenant: string | null = null;
  worker.use(
    http.get('/auth/current/resources', ({ request }) => {
      seenTenant = request.headers.get('x-tenant-id');
      return HttpResponse.json(resourcesFor('t2'));
    }),
  );
  localStorage.setItem('admin_web_selected_tenant_id', 't1');
  const { queryClient } = renderApp({ session: manager });
  queryClient.setQueryData(['system', 'users'], [{ id: 'u1' }]);
  await userEvent.click(screen.getByRole('combobox', { name: '切换租户' }));
  await userEvent.click(await screen.findByRole('option', { name: '租户乙' }));
  expect(queryClient.getQueryCache().getAll()).toStrictEqual([]);
  expect(localStorage.getItem('admin_web_selected_tenant_id')).toBe('t2');
  await waitFor(() => expect(seenTenant).toBe('t2'));
});

/** 生成器生成的那种页面：直接用 useQuery，不包 RequireAccess。 */
function RowsPage() {
  const { client } = useShell();
  const rows = useQuery({
    queryKey: ['demo', 'rows'],
    queryFn: async () => (await client.get<string[]>('/demo/rows')).data,
  });
  return <p>{rows.data?.join(',') ?? 'ROWS_LOADING'}</p>;
}

test("after switching tenant, a page outside RequireAccess shows the new tenant's rows", async () => {
  worker.use(
    http.get('/auth/current/resources', ({ request }) =>
      HttpResponse.json(
        resourcesFor(request.headers.get('x-tenant-id') ?? 't1'),
      ),
    ),
    http.get('/demo/rows', ({ request }) =>
      HttpResponse.json([`row-of-${request.headers.get('x-tenant-id')}`]),
    ),
  );
  localStorage.setItem('admin_web_selected_tenant_id', 't1');
  const demo: RemoteRoutes = {
    routes: [{ path: '/demo/rows', element: <RowsPage /> }],
    menu: [],
  };
  renderApp({
    apps: [
      {
        name: 'demo',
        entry: 'http://localhost:8109/mf-manifest.json',
        routePrefixes: ['/demo'],
      },
    ],
    loadModule: async (id) =>
      id === 'demo/routes' ? { default: demo } : Promise.reject(new Error(id)),
    session: manager,
    route: '/demo/rows',
  });
  const main = screen.getByRole('main');
  expect(await within(main).findByText('row-of-t1')).toBeVisible();
  await userEvent.click(screen.getByRole('combobox', { name: '切换租户' }));
  await userEvent.click(await screen.findByRole('option', { name: '租户乙' }));
  expect(await within(main).findByText('row-of-t2')).toBeVisible();
  expect(within(main).queryByText('row-of-t1')).toBeNull();
});

test('account menu logout clears the tenant before calling logout', async () => {
  let tenantAtLogout: string | null = 'NOT_CALLED';
  worker.use(
    http.post('/logout', () => {
      tenantAtLogout = localStorage.getItem('admin_web_selected_tenant_id');
      return new HttpResponse(null, {
        status: 202,
        headers: { Location: 'https://keycloak.example.invalid/logout' },
      });
    }),
  );
  localStorage.setItem('admin_web_selected_tenant_id', 't1');
  const { navigation } = renderApp({ session: manager });
  await userEvent.click(screen.getByRole('button', { name: '账户菜单' }));
  await userEvent.click(
    await screen.findByRole('menuitem', { name: '退出登录' }),
  );
  await waitFor(() =>
    expect(navigation.assign).toHaveBeenCalledWith(
      'https://keycloak.example.invalid/logout',
    ),
  );
  expect(tenantAtLogout).toBe(null);
});

test('account settings show the 1.2.4 fields', async () => {
  renderApp({ session: manager });
  await userEvent.click(screen.getByRole('button', { name: '账户菜单' }));
  await userEvent.click(
    await screen.findByRole('menuitem', { name: '账户设置' }),
  );
  const dialog = await screen.findByRole('dialog', { name: '账户设置' });
  for (const [label, value] of [
    ['用户名', 'manager'],
    ['昵称', '管理员甲'],
    ['管理员分类', '租户管理员'],
    ['当前租户', '租户甲'],
    ['可用租户', '2'],
  ]) {
    expect(
      within(dialog).getByText(label).nextElementSibling,
    ).toHaveTextContent(value);
  }
});

test('theme toggle sets the dark class and persists', async () => {
  renderApp({ session: manager });
  await userEvent.click(screen.getByRole('button', { name: '主题' }));
  await userEvent.click(
    await screen.findByRole('menuitemradio', { name: '暗色' }),
  );
  await waitFor(() => expect(document.documentElement).toHaveClass('dark'));
  expect(localStorage.getItem('admin_web_theme')).toBe('dark');
});

test('language switch shows English and remembers the choice', async () => {
  renderApp({ session: manager });
  await userEvent.click(screen.getByRole('button', { name: '语言' }));
  await userEvent.click(
    await screen.findByRole('menuitemradio', { name: 'English' }),
  );
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Dashboard' }),
  ).toBeVisible();
  expect(localStorage.getItem('admin_web_locale')).toBe('en-US');
});

test('session recovery offers retry', async () => {
  let reads = 0;
  worker.use(
    http.get('/auth/current/resources', () => {
      reads++;
      return reads === 1
        ? new HttpResponse(null, { status: 500 })
        : HttpResponse.json(resourcesFor('t1'));
    }),
  );
  renderApp();
  expect(
    await screen.findByRole('heading', { name: '会话暂未恢复' }),
  ).toBeVisible();
  expect(screen.getByRole('button', { name: '退出登录' })).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: '重试' }));
  expect(
    await screen.findByRole('heading', { level: 1, name: '工作台' }),
  ).toBeVisible();
  expect(reads).toBe(2);
});

const message: RemoteApp = {
  name: 'message',
  entry: 'http://localhost:8102/mf-manifest.json',
  routePrefixes: ['/message'],
};

function Bell({ userId, tenantId }: { userId: string; tenantId?: string }) {
  return <span data-testid="bell">{`${userId}@${tenantId}`}</span>;
}

/** message 子应用：./routes 没有菜单，./Bell 是上面的铃铛。 */
const messageModules = async (id: string) => {
  if (id === 'message/routes') return { default: { routes: [], menu: [] } };
  if (id === 'message/Bell') return { Bell };
  throw new Error(`${id} is down`);
};

test('bell slot renders nothing when message/Bell fails to load', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  renderApp({
    apps: [message],
    session: manager,
    loadModule: async () => Promise.reject(new Error('message is down')),
  });
  expect(
    await screen.findByRole('heading', { level: 1, name: '工作台' }),
  ).toBeVisible();
  expect(screen.queryByTestId('bell')).toBeNull();
});

test('bell slot renders the message bell with the current user and tenant', async () => {
  renderApp({ apps: [message], session: manager, loadModule: messageModules });
  expect(await screen.findByTestId('bell')).toHaveTextContent('u1@t1');
});

test('the message bell waits until apps.json is read, however late', async () => {
  let readApps!: (apps: RemoteApp[]) => void;
  renderApp({
    registry: () =>
      new Promise((resolve) => {
        readApps = resolve;
      }),
    session: manager,
    loadModule: messageModules,
  });
  expect(
    await screen.findByRole('heading', { level: 1, name: '工作台' }),
  ).toBeVisible();
  expect(screen.queryByTestId('bell')).toBeNull();
  readApps([message]);
  expect(await screen.findByTestId('bell')).toHaveTextContent('u1@t1');
});

test('a bell that missed an unreadable apps.json loads after the retry', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  let attempts = 0;
  renderApp({
    registry: () => {
      attempts += 1;
      return attempts === 1
        ? Promise.reject(new Error('apps.json unreachable'))
        : Promise.resolve([message]);
    },
    session: manager,
    route: '/message/send',
    loadModule: messageModules,
  });
  const main = screen.getByRole('main');
  await userEvent.click(
    await within(main).findByRole('button', { name: '重试' }),
  );
  expect(await screen.findByTestId('bell')).toHaveTextContent('u1@t1');
});

test('dashboard shows the tenant, counts and both resource lists', async () => {
  renderApp({ session: manager });
  // 页头的租户切换也显示租户名，只看工作台页面本身。
  const page = await screen.findByRole('region', { name: '工作台' });
  expect(within(page).getByText('租户甲')).toBeVisible();
  expect(within(page).getByText('menu:rag:graph')).toBeVisible();
  expect(within(page).getByText('/auth/manage/**')).toBeVisible();
});

test('unknown paths show the not-found page', async () => {
  renderApp({ session: manager, route: '/nowhere' });
  expect(await screen.findByText('页面不存在')).toBeVisible();
});
