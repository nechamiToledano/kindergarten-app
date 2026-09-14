import type { KindergartenSummary } from '@kga/contracts';
import { api } from '../../shared/api/client';

export const getKindergartenSummary = () => api<KindergartenSummary>('/reports/kindergarten/summary');
