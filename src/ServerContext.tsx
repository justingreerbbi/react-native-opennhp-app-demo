import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {close} from 'react-native-opennhp';
import {unlinkRegistration} from './agent';
import {
  ServerConfig,
  clearServerConfig,
  getServerConfig,
  setServerConfig,
  sanitizeServerConfig,
} from './serverStore';

type ServerContextValue = {
  config: ServerConfig | null;
  linked: boolean;
  loading: boolean;
  link: (config: ServerConfig) => Promise<void>;
  unlink: () => Promise<void>;
};

const ServerContext = createContext<ServerContextValue | null>(null);

export function ServerProvider({children}: {children: React.ReactNode}) {
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await getServerConfig();
      if (!cancelled) {
        setConfig(stored);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const link = useCallback(async (next: ServerConfig) => {
    const safe = sanitizeServerConfig(next);
    if (!safe) {
      throw new Error('Invalid server settings.');
    }
    await setServerConfig(safe);
    setConfig(safe);
  }, []);

  const unlink = useCallback(async () => {
    try {
      await close();
    } catch {
      // agent may not be running
    }
    await clearServerConfig();
    await unlinkRegistration();
    setConfig(null);
  }, []);

  const value = useMemo(
    () => ({config, linked: config !== null, loading, link, unlink}),
    [config, loading, link, unlink],
  );

  return <ServerContext.Provider value={value}>{children}</ServerContext.Provider>;
}

export function useServer(): ServerContextValue {
  const value = useContext(ServerContext);
  if (!value) {
    throw new Error('useServer must be used within a ServerProvider');
  }
  return value;
}
