import { useEffect, useState } from 'react';

/** 呼叫資料層函式（之後換成真 API 也一樣），回傳 { data, loading, error } */
export function useAsync<T>(fn: () => Promise<T>, deps: React.DependencyList = []) {
  const [state, setState] = useState<{ data: T | undefined; loading: boolean; error: Error | undefined }>({
    data: undefined,
    loading: true,
    error: undefined,
  });
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    fn().then(
      (data) => alive && setState({ data, loading: false, error: undefined }),
      (error: Error) => alive && setState({ data: undefined, loading: false, error }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
