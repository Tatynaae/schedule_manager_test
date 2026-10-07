import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp, ConfigProvider } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { setNotificationApi } from './components/notify';
import { theme } from './theme';
import './styles.css';

const queryClient = new QueryClient();

function NotificationBridge() {
  const { notification } = AntApp.useApp();
  useEffect(() => setNotificationApi(notification), [notification]);
  return null;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider locale={ruRU} theme={theme}>
      <AntApp notification={{ placement: 'bottomRight', maxCount: 3 }}>
        <NotificationBridge />
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  </StrictMode>,
);
