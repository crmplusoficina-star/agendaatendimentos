import React from 'react';
import ReactDOM from 'react-dom/client';
import AppNoAuthV2 from './AppNoAuthV2';
import './noauth.css';
import './period.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppNoAuthV2 />
  </React.StrictMode>,
);
