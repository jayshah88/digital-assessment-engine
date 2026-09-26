/**
 * Public-facing assessment app entry point
 */
import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './styles/app.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

// Mount all assessment roots on the page (supports multiple shortcodes).
const mountAssessments = () => {
  const roots = document.querySelectorAll('#dap-assessment-root');


  roots.forEach((el) => {
    const assessmentId   = el.dataset.assessmentId   || '';
    const assessmentSlug = el.dataset.assessmentSlug || '';



    try {
      createRoot(el).render(
        <StrictMode>
          <QueryClientProvider client={queryClient}>
            <App assessmentId={assessmentId} assessmentSlug={assessmentSlug} />
          </QueryClientProvider>
        </StrictMode>
      );

    } catch (err) {
      // Mounting error handled gracefully
    }
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountAssessments);
} else {
  mountAssessments();
}
