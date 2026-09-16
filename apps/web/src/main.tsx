import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@kga/ui';
import './index.css';
import './styles/play-surface.css';
import App from './App';
import { AudioUnlockProvider } from './shared/audio/AudioUnlockProvider';
import { AuthProvider } from './shared/auth/AuthProvider';
import { OutboxProvider } from './shared/outbox/OutboxProvider';
import { ApiError } from './shared/api/client';

/**
 * Query defaults tuned for the room this runs in: a teacher on kindergarten
 * WiFi, on an iPad that sleeps between children.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Waking the iPad should show current numbers, not what was on screen
      // when it went to sleep.
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => {
        // Retrying a 401/403/404 cannot succeed and only delays the message.
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: { retry: false },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary onError={(error) => console.error(error)}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <OutboxProvider>
              <AudioUnlockProvider>
                <App />
              </AudioUnlockProvider>
            </OutboxProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
