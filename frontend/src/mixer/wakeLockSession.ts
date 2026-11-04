interface ScreenLock {
  release(): Promise<void>;
  addEventListener(type: 'release', listener: () => void): void;
}
interface Options {
  request: () => Promise<ScreenLock>;
  visible: () => boolean;
  subscribe: (listener: () => void) => () => void;
  status: (message: string) => void;
}

/** One enabled session. Releasing an old lock must never clear its replacement. */
export function startWakeLockSession({ request, visible, subscribe, status }: Options) {
  let disposed = false, requesting = false, lock: ScreenLock | undefined;
  const release = (old: ScreenLock | undefined) => {
    void old?.release().catch(() => { if (!disposed) status('Could not release screen lock — toggle to retry'); });
  };
  const sync = () => {
    if (disposed) return;
    if (!visible()) {
      const previous = lock;
      lock = undefined; // Detach before asynchronous release or a quick visibility return.
      status('Waiting for visible screen');
      release(previous);
      return;
    }
    if (lock || requesting) return;
    requesting = true;
    status('Requesting screen lock…');
    void request().then(acquired => {
      if (disposed || !visible()) { release(acquired); return; }
      lock = acquired;
      status('Active');
      acquired.addEventListener('release', () => {
        if (lock !== acquired) return;
        lock = undefined;
        if (!disposed) status(visible() ? 'Released by browser — toggle to retry' : 'Waiting for visible screen');
      });
    }).catch(() => {
      if (!disposed) status(visible() ? 'Not held — browser declined; toggle to retry' : 'Waiting for visible screen');
    }).finally(() => { requesting = false; });
  };
  const unsubscribe = subscribe(sync);
  sync();
  return () => { disposed = true; unsubscribe(); const previous = lock; lock = undefined; release(previous); };
}
