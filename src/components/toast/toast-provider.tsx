"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import styles from "./toast-provider.module.scss";

type ToastKind = "success" | "error" | "info";

export type ToastOptions = {
  description?: string;
  duration?: number;
};

type ToastItem = {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
  duration: number;
};

type ToastStyle = CSSProperties & { "--toast-duration": string };

export type ToastApi = {
  success: (title: string, options?: ToastOptions) => void;
  error: (title: string, options?: ToastOptions) => void;
  info: (title: string, options?: ToastOptions) => void;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

function ToastIcon({ kind }: { kind: ToastKind }) {
  if (kind === "success") {
    return (
      <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
        <path d="m5 10.2 3.2 3.2L15.5 6" />
      </svg>
    );
  }

  if (kind === "error") {
    return (
      <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
        <path d="M10 5.5v5M10 14.2h.01M10 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Z" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
      <path d="M10 9v4M10 6.5h.01M17.5 10a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" />
    </svg>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }

    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback(
    (kind: ToastKind, title: string, options: ToastOptions = {}) => {
      const id = ++nextId.current;
      const duration = options.duration ?? 5000;

      setToasts((current) => [
        ...current,
        { id, kind, title, description: options.description, duration },
      ]);

      if (duration > 0) {
        timers.current.set(
          id,
          window.setTimeout(() => dismiss(id), duration),
        );
      }
    },
    [dismiss],
  );

  const success = useCallback(
    (title: string, options?: ToastOptions) => addToast("success", title, options),
    [addToast],
  );
  const error = useCallback(
    (title: string, options?: ToastOptions) => addToast("error", title, options),
    [addToast],
  );
  const info = useCallback(
    (title: string, options?: ToastOptions) => addToast("info", title, options),
    [addToast],
  );

  const toast = useMemo(
    () => ({ success, error, info, dismiss }),
    [success, error, info, dismiss],
  );

  useEffect(
    () => () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
      timers.current.clear();
    },
    [],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        aria-label="Notifications"
        className={styles.viewport}
        role="region"
      >
        {toasts.map((item) => (
          <article
            key={item.id}
            className={`${styles.toast} ${styles[item.kind]}`}
            role={item.kind === "error" ? "alert" : "status"}
            style={
              item.duration > 0
                ? ({ "--toast-duration": `${item.duration}ms` } as ToastStyle)
                : undefined
            }
          >
            <span className={styles.icon}>
              <ToastIcon kind={item.kind} />
            </span>
            <span className={styles.copy}>
              <span className={styles.title}>{item.title}</span>
              {item.description && (
                <span className={styles.description}>{item.description}</span>
              )}
            </span>
            <button
              aria-label="Dismiss notification"
              className={styles.dismiss}
              onClick={() => dismiss(item.id)}
              type="button"
            >
              <svg aria-hidden="true" fill="none" viewBox="0 0 16 16">
                <path d="m4 4 8 8m0-8-8 8" />
              </svg>
            </button>
            {item.duration > 0 && (
              <span aria-hidden="true" className={styles.progress} />
            )}
          </article>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider.");
  }
  return context;
}
