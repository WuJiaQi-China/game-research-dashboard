import { db } from './config';
import {
  collection, query, where, orderBy, limit, getDocs,
  doc, getDoc, setDoc, onSnapshot, writeBatch,
  type QueryConstraint, type DocumentData,
} from 'firebase/firestore';
import type { ContentRecord, ScrapeConfig, ScrapeRun } from '@/lib/types';

const RECORDS_COL = 'records';
const CONFIG_DOC = 'scrapeConfigs/current';

export async function fetchRecords(filters?: {
  type?: string;
  source?: string;
  maxResults?: number;
}): Promise<ContentRecord[]> {
  const constraints: QueryConstraint[] = [];
  if (filters?.type) constraints.push(where('type', '==', filters.type));
  if (filters?.source) constraints.push(where('source', '==', filters.source));
  if (filters?.maxResults) constraints.push(limit(filters.maxResults));

  const q = query(collection(db, RECORDS_COL), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as ContentRecord));
}

export async function fetchAllRecords(): Promise<ContentRecord[]> {
  const q = query(collection(db, RECORDS_COL));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as ContentRecord));
}

export async function fetchConfig(): Promise<ScrapeConfig | null> {
  const snap = await getDoc(doc(db, CONFIG_DOC));
  return snap.exists() ? (snap.data() as ScrapeConfig) : null;
}

export async function saveConfig(config: Partial<ScrapeConfig>): Promise<void> {
  await setDoc(doc(db, CONFIG_DOC), config, { merge: true });
}

export async function deleteRecords(ids: string[]): Promise<void> {
  // Firestore batch limit is 500
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    const batch = writeBatch(db);
    for (const id of chunk) {
      batch.delete(doc(db, RECORDS_COL, id));
    }
    await batch.commit();
  }
}

export function subscribeScrapeRun(
  runId: string,
  callback: (run: ScrapeRun | null) => void
): () => void {
  return onSnapshot(doc(db, 'scrapeRuns', runId), (snap) => {
    callback(snap.exists() ? ({ ...snap.data(), id: snap.id } as ScrapeRun) : null);
  });
}
