import React from 'react';
import { renderQueryPage } from '@shared/utils/renderQueryPage';
import { EntitiesPage } from './EntitiesPage';

renderQueryPage(<EntitiesPage />, 5 * 60 * 1000);
