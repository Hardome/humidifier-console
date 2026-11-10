import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

import { client } from '@api/.kubb/client';

client.setConfig({ baseURL: 'http://localhost' });

afterEach(cleanup);
