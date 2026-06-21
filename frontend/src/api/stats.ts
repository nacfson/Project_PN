import type { StatsSummary } from '../types';
import { getJson } from './client';

export function getStatsSummary(): Promise<StatsSummary> {
  return getJson<StatsSummary>('/api/stats/summary');
}
