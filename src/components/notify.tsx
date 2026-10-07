import { Button } from 'antd';
import type { NotificationInstance } from 'antd/es/notification/interface';

/**
 * Thin wrapper over antd `notification`, so callers outside React render
 * (DnD handlers, store-driven actions) can show a toast with an optional action.
 * The instance comes from `<App>` context, so it inherits the theme and locale.
 */
let api: NotificationInstance | null = null;
let seq = 0;

export const setNotificationApi = (instance: NotificationInstance) => {
  api = instance;
};

export interface Toast {
  tone: 'error' | 'success' | 'info';
  title: string;
  lines?: string[];
  action?: { label: string; run: () => void };
}

export function notify({ tone, title, lines = [], action }: Toast) {
  if (!api) return;
  const key = `toast-${++seq}`;
  const instance = api;
  instance.open({
    key,
    type: tone,
    title,
    description: lines.length ? lines.map((line) => <div key={line}>{line}</div>) : undefined,
    actions: action && (
      <Button
        size="small"
        onClick={() => {
          action.run();
          instance.destroy(key);
        }}
      >
        {action.label}
      </Button>
    ),
    duration: tone === 'error' ? 6 : 4,
    pauseOnHover: true,
    showProgress: true,
  });
}
