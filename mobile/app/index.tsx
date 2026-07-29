import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';

import { useAuthStore } from '../store/authStore';

export default function Index() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const hydrateFromStorage = useAuthStore((s) => s.hydrateFromStorage);
  const [checkedStorage, setCheckedStorage] = useState(false);

  useEffect(() => {
    if (accessToken) {
      setCheckedStorage(true);
      return;
    }
    hydrateFromStorage().finally(() => setCheckedStorage(true));
    // Only run once on mount: this restores a persisted session before the first redirect decision.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!checkedStorage) {
    return null;
  }

  return <Redirect href={accessToken ? '/(tabs)/products' : '/(auth)/login'} />;
}
