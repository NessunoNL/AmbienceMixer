import { useEffect, useState } from 'react';
import { startWakeLockSession } from './wakeLockSession';

export function useWakeLock() {
  const [enabled, setEnabled] = useState(false), [status, setStatus] = useState('Off');
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator && window.isSecureContext;
  useEffect(() => {
    if (!enabled) { setStatus('Off'); return; }
    if (!supported) { setStatus('Unavailable — requires a supported browser and HTTPS'); return; }
    return startWakeLockSession({
      request: () => navigator.wakeLock.request('screen'),
      visible: () => document.visibilityState === 'visible',
      status: setStatus,
      subscribe: listener => {
        document.addEventListener('visibilitychange', listener);
        return () => document.removeEventListener('visibilitychange', listener);
      },
    });
  }, [enabled, supported]);
  return { enabled, setEnabled, status, supported };
}
