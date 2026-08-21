import React from 'react';
import ReactDOM from 'react-dom/client';
import AppNoAuthV3 from './AppNoAuthV3';
import './noauth.css';
import './period.css';
import './quick-context.css';
import './operations.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppNoAuthV3 />
  </React.StrictMode>,
);
