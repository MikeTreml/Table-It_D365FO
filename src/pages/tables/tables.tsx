import React from 'react';
import { createRoot } from 'react-dom/client';
import { TablesPage } from './TablesPage';
import '../../styles/global.css';

const root = document.getElementById('root');
if (root) createRoot(root).render(<TablesPage />);
