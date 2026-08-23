import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { AdminApp } from './admin/AdminApp.jsx';
import { PrivacyPolicy } from './pages/PrivacyPolicy.jsx';
import { TermsOfService } from './pages/TermsOfService.jsx';
import './index.css';

function Root() {
  const path = window.location.pathname.replace(/\/$/, '') || '/';

  if (path === '/privacy') {
    return <PrivacyPolicy />;
  }
  if (path === '/terms') {
    return <TermsOfService />;
  }
  if (path === '/admin' || path.startsWith('/admin/')) {
    return <AdminApp />;
  }

  return <App />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' }).catch(() => {});
  });
}
