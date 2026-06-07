import React from 'react';
import { renderQueryPage } from '@shared/utils/renderQueryPage';
import { EntityDataPage } from './EntityDataPage';

renderQueryPage(<EntityDataPage />, 5 * 60 * 1000);
