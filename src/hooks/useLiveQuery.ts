import { useEffect, useState } from "react";
import { liveQuery } from "dexie";

export function useLiveQuery<T>(factory: () => Promise<T> | T, deps: unknown[], initial: T): T {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    const obs = liveQuery(factory);
    const sub = obs.subscribe({
      next: (v) => setValue(v),
      error: () => undefined,
    });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return value;
}
