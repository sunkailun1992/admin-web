import type { AxiosInstance } from 'axios';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { computeAccess, type Access } from './access.ts';
import { bootstrapSession } from './bootstrap.ts';
import { isLoginPage, redirectToLogin } from './login.ts';
import { clearLegacyTokens } from './tenant.ts';
import type { SessionState } from './types.ts';

export type SessionContextValue = SessionState & {
  /** 正在读取会话（首次或 refresh）。 */
  loading: boolean;
  /** 重新读取会话（切换租户、恢复页重试）；进行中再调用不会重复请求。 */
  refresh: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export type SessionProviderProps = {
  client: AxiosInstance;
  /** 已知的会话（测试、Storybook）：直接使用，不向后端读取。 */
  session?: SessionState;
  /** 没有网关会话时调用；默认整页跳网关登录。子应用单独运行时改为提示先在主应用登录。 */
  onUnauthenticated?: () => void;
  children: ReactNode;
};

const onLoginPage = () =>
  typeof window !== 'undefined' && isLoginPage(window.location.pathname);

/** 在主应用启动时读取当前用户、资源与可切换的租户，经共享单例提供给各子应用。 */
export function SessionProvider({
  client,
  session,
  onUnauthenticated,
  children,
}: SessionProviderProps) {
  const [state, setState] = useState<SessionState>(session ?? {});
  // 登录失败页不检查会话：读不到会话就会跳回登录，回调一直失败时形成整页循环。
  const [loading, setLoading] = useState(
    () => session === undefined && !onLoginPage(),
  );
  const inFlight = useRef<Promise<void> | null>(null);
  const controller = useRef<AbortController | null>(null);
  const unauthenticated = useRef(onUnauthenticated);

  useEffect(() => {
    unauthenticated.current = onUnauthenticated;
  }, [onUnauthenticated]);

  // 同一时间只读一次；卸载（含 StrictMode 的二次挂载）时中止并丢掉这一次，结果不再接纳。
  const load = useCallback((): Promise<void> => {
    if (inFlight.current) return inFlight.current;
    const abort = new AbortController();
    controller.current = abort;
    const run: Promise<void> = bootstrapSession(client, abort.signal)
      .then((next) => {
        if (abort.signal.aborted) return;
        setState(next);
        if (!next.currentUser && !next.sessionRecovery)
          (unauthenticated.current ?? redirectToLogin)();
      })
      .finally(() => {
        if (inFlight.current === run) inFlight.current = null;
        if (!abort.signal.aborted) setLoading(false);
      });
    inFlight.current = run;
    return run;
  }, [client]);

  const refresh = useCallback(() => {
    if (!inFlight.current) setLoading(true);
    return load();
  }, [load]);

  useEffect(() => {
    if (session !== undefined) return undefined;
    if (onLoginPage()) {
      clearLegacyTokens();
      return undefined;
    }
    void load();
    return () => {
      controller.current?.abort();
      inFlight.current = null;
    };
  }, [load, session]);

  const value = useMemo<SessionContextValue>(
    () => ({ ...state, loading, refresh }),
    [state, loading, refresh],
  );
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession 要在 SessionProvider 里使用');
  return value;
}

export function useAccess(): Access {
  const { currentUser } = useSession();
  return useMemo(() => computeAccess(currentUser), [currentUser]);
}
