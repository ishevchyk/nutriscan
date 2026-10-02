import { createContext, ReactNode, useContext } from 'react';

import { useSettingsStore } from '../store/settingsStore';

type ThemeOverride = 'light' | 'dark' | null;

const ThemeOverrideContext = createContext<ThemeOverride>(null);

export function ThemeOverrideProvider({ children }: { children: ReactNode }) {
  const settings = useSettingsStore((s) => s.settings);
  const loaded = useSettingsStore((s) => s.loaded);
  // Until settings have loaded this session, or until the user has ever
  // chosen a theme, there's nothing to override with -- fall back to the
  // device's own OS scheme rather than flashing light/dark.
  const override: ThemeOverride = loaded && settings?.theme ? settings.theme : null;

  return <ThemeOverrideContext.Provider value={override}>{children}</ThemeOverrideContext.Provider>;
}

export function useThemeOverride(): ThemeOverride {
  return useContext(ThemeOverrideContext);
}
