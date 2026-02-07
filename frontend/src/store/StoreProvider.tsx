'use client';

import { useRef } from 'react';
import { Provider } from 'react-redux';
import { AppStore, makeStore } from '@/store/store';

type StoreProviderProps = {
  children: React.ReactNode;
};

export function StoreProvider({ children }: StoreProviderProps) {
  const storeRef = useRef<AppStore>();

  if (!storeRef.current) {
    storeRef.current = makeStore();
  }

  return <Provider store={storeRef.current}>{children}</Provider>;
}
