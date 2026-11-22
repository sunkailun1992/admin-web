import { render, screen, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { act, StrictMode } from 'react';
import { expect, test, vi } from 'vitest';
import {
  RequireAccess,
  SessionProvider,
  useAccess,
  useSession,
  type SessionState,
} from '../src/index.ts';
import { resources, startMswServer, testClient } from './support.ts';

const server = startMswServer();

function Probe() {
  const session = useSession();
  const access = useAccess();
  const status = session.loading
    ? 'LOADING'
    : session.currentUser
      ? `USER:${session.name}`
      : session.sessionRecovery
        ? 'RECOVERY'
        : 'ANONYMOUS';
  return (
    <>
      <p>{status}</p>
      <p>{access.canSeeRagGraph ? 'CAN_GRAPH' : 'NO_GRAPH'}</p>
      <button type="button" onClick={() => void session.refresh()}>
        REFRESH
      </button>
    </>
  );
}

function countReads(response: () => Response | Promise<Response>) {
  const counter = { reads: 0 };
  server.use(
    http.get('/auth/current/resources', () => {
      counter.reads++;
      return response();
    }),
  );
  return counter;
}

const signedIn: SessionState = {
  currentUser: {
    userId: 'u',
    username: 'u',
    tenantId: 't',
    name: 'PRESET',
    permissions: [],
    frontendResources: [],
  },
  currentTenantId: 't',
  name: 'PRESET',
};

test('SessionProvider bootstraps and shares the session and the access flags', async () => {
  countReads(() => HttpResponse.json({ success: true, data: resources }));
  render(
    <SessionProvider client={testClient().client} onUnauthenticated={() => {}}>
      <Probe />
    </SessionProvider>,
  );
  expect(screen.getByText('LOADING')).toBeInTheDocument();
  expect(await screen.findByText('USER:合成用户')).toBeInTheDocument();
  expect(screen.getByText('CAN_GRAPH')).toBeInTheDocument();
});

test('without a gateway session it calls onUnauthenticated once', async () => {
  countReads(() => new HttpResponse(null, { status: 401 }));
  const onUnauthenticated = vi.fn();
  render(
    <SessionProvider
      client={testClient().client}
      onUnauthenticated={onUnauthenticated}
    >
      <Probe />
    </SessionProvider>,
  );
  expect(await screen.findByText('ANONYMOUS')).toBeInTheDocument();
  expect(onUnauthenticated).toHaveBeenCalledTimes(1);
});

test('the recovery state does not send the browser to login', async () => {
  countReads(() => new HttpResponse(null, { status: 500 }));
  const onUnauthenticated = vi.fn();
  render(
    <SessionProvider
      client={testClient().client}
      onUnauthenticated={onUnauthenticated}
    >
      <Probe />
    </SessionProvider>,
  );
  expect(await screen.findByText('RECOVERY')).toBeInTheDocument();
  expect(onUnauthenticated).not.toHaveBeenCalled();
});

test('the login failure page neither reads the session nor sends the browser to login', async () => {
  window.history.replaceState(null, '', '/login?error');
  const counter = countReads(() =>
    HttpResponse.json({ success: true, data: resources }),
  );
  const onUnauthenticated = vi.fn();
  render(
    <SessionProvider
      client={testClient().client}
      onUnauthenticated={onUnauthenticated}
    >
      <Probe />
    </SessionProvider>,
  );
  expect(await screen.findByText('ANONYMOUS')).toBeInTheDocument();
  expect(counter.reads).toBe(0);
  expect(onUnauthenticated).not.toHaveBeenCalled();
});

test('refresh is single-flight', async () => {
  let release: () => void = () => {};
  const counter = countReads(async () => {
    if (counter.reads > 1)
      await new Promise<void>((resolve) => (release = resolve));
    return HttpResponse.json({ success: true, data: resources });
  });
  render(
    <SessionProvider client={testClient().client} onUnauthenticated={() => {}}>
      <Probe />
    </SessionProvider>,
  );
  await screen.findByText('USER:合成用户');
  const button = screen.getByRole('button', { name: 'REFRESH' });
  act(() => {
    button.click();
    button.click();
  });
  await waitFor(() => expect(counter.reads).toBe(2));
  release();
  await screen.findByText('USER:合成用户');
  expect(counter.reads).toBe(2);
});

test('a preset session skips the request', () => {
  render(
    <SessionProvider client={testClient().client} session={signedIn}>
      <Probe />
    </SessionProvider>,
  );
  expect(screen.getByText('USER:PRESET')).toBeInTheDocument();
});

test('RequireAccess shows the page only with the flag and the 403 page otherwise', () => {
  const { unmount } = render(
    <SessionProvider client={testClient().client} session={signedIn}>
      <RequireAccess flag="canSeeTenant">
        <p>PAGE</p>
      </RequireAccess>
    </SessionProvider>,
  );
  expect(screen.getByText('无权限访问')).toBeInTheDocument();
  expect(screen.queryByText('PAGE')).toBeNull();
  unmount();
  const manager: SessionState = {
    ...signedIn,
    currentUser: {
      ...signedIn.currentUser!,
      permissions: ['user:auth:manage'],
      frontendResources: [{ id: 'r1', code: 'menu:tenant', tenantId: 't' }],
    },
  };
  render(
    <SessionProvider client={testClient().client} session={manager}>
      <RequireAccess flag="canSeeTenant">
        <p>PAGE</p>
      </RequireAccess>
    </SessionProvider>,
  );
  expect(screen.getByText('PAGE')).toBeInTheDocument();
});

test('RequireAccess renders nothing while the session is loading', () => {
  countReads(async () => {
    await delay('infinite');
    return HttpResponse.json({ success: true, data: resources });
  });
  render(
    <SessionProvider client={testClient().client} onUnauthenticated={() => {}}>
      <RequireAccess flag="canSeeTenant">
        <p>PAGE</p>
      </RequireAccess>
    </SessionProvider>,
  );
  expect(screen.queryByText('PAGE')).toBeNull();
  expect(screen.queryByText('无权限访问')).toBeNull();
});

test('useSession outside SessionProvider is a programming error', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  expect(() => render(<Probe />)).toThrow(/SessionProvider/);
});

test('StrictMode remounting still finishes loading the session', async () => {
  countReads(() => HttpResponse.json({ success: true, data: resources }));
  render(
    <StrictMode>
      <SessionProvider
        client={testClient().client}
        onUnauthenticated={() => {}}
      >
        <Probe />
      </SessionProvider>
    </StrictMode>,
  );
  expect(await screen.findByText('USER:合成用户')).toBeInTheDocument();
});
