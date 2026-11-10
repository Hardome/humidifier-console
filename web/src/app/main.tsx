import { StrictMode } from 'react';

import { RouterProvider } from '@tanstack/react-router';
import { createRoot } from 'react-dom/client';

import { AppProviders } from './providers/app-providers';
import { router } from './routes/router';
import './styles.css';

const element = document.querySelector('#root');

if (element) {
  createRoot(element).render(
    <StrictMode>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </StrictMode>,
  );
}
