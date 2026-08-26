"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Lets a field tell the form it is not ready to be submitted yet.
 *
 * A control that prepares its value asynchronously — the photo picker encoding
 * an image, say — would otherwise let the user submit the *previous* value while
 * the new one is still being produced. Fields register by name so several can be
 * busy at once without clobbering each other.
 */
interface FormBusyValue {
  busy: boolean;
  setFieldBusy: (field: string, busy: boolean) => void;
}

const FormBusyContext = createContext<FormBusyValue>({
  busy: false,
  setFieldBusy: () => {},
});

export function useFormBusy(): FormBusyValue {
  return useContext(FormBusyContext);
}

export function FormBusyProvider({ children }: { children: ReactNode }) {
  const [busyFields, setBusyFields] = useState<readonly string[]>([]);

  const setFieldBusy = useCallback((field: string, busy: boolean) => {
    setBusyFields((current) => {
      const present = current.includes(field);
      if (busy === present) return current;
      return busy
        ? [...current, field]
        : current.filter((name) => name !== field);
    });
  }, []);

  const value = useMemo(
    () => ({ busy: busyFields.length > 0, setFieldBusy }),
    [busyFields, setFieldBusy],
  );

  return (
    <FormBusyContext.Provider value={value}>{children}</FormBusyContext.Provider>
  );
}
