import type { SenseOption } from '../types';
import { getJson } from './client';

export interface WordOfTheDay {
  date: string;
  sense_options: SenseOption[];
}

export interface ContentChallenge {
  id: string;
  title: string;
  description: string;
  word_count: number;
  status: string;
}

export interface ContentChallengesResponse {
  challenges: ContentChallenge[];
}

export function getWordOfTheDay(): Promise<WordOfTheDay> {
  return getJson<WordOfTheDay>('/api/content/word-of-the-day');
}

export function getContentChallenges(): Promise<ContentChallengesResponse> {
  return getJson<ContentChallengesResponse>('/api/content/challenges');
}
