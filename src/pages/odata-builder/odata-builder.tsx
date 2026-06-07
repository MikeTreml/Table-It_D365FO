import React from 'react';
import { createRoot } from 'react-dom/client';
import { ODataBuilderPage } from './ODataBuilderPage';
import '../../styles/global.css';

const root = document.getElementById('root');
if (root) createRoot(root).render(<ODataBuilderPage />);
