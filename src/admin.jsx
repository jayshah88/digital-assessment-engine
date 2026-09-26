/**
 * Admin App Entry Point
 */
import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AdminApp from './AdminApp';
import './styles/admin.css';

const root = document.getElementById('dap-admin-root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <AdminApp />
    </StrictMode>
  );
}
