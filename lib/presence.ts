import type { PublicUser } from "./auth";
import { listEncryptedJson, writeEncryptedJson } from "./cloud-storage";

const PRESENCE_PREFIX = "intern-diary/presence/";
const ONLINE_WINDOW_MS = 150_000;

export interface PresenceRecord {
  userId: string;
  username: string;
  fullName: string;
  lastSeen: string;
}

const presencePath = (userId: string) => `${PRESENCE_PREFIX}${userId}.json`;

export async function touchPresence(user: PublicUser) {
  const record: PresenceRecord = { userId: user.id, username: user.username, fullName: user.fullName, lastSeen: new Date().toISOString() };
  await writeEncryptedJson(presencePath(user.id), record);
  return record;
}

export async function markPresenceOffline(user: PublicUser) {
  await writeEncryptedJson(presencePath(user.id), { userId: user.id, username: user.username, fullName: user.fullName, lastSeen: new Date(0).toISOString() } satisfies PresenceRecord);
}

export async function listOnlinePresence() {
  const cutoff = Date.now() - ONLINE_WINDOW_MS;
  const records = await listEncryptedJson<PresenceRecord>(PRESENCE_PREFIX);
  return records.map(({ value }) => value)
    .filter(value => Boolean(value.userId && value.username && Date.parse(value.lastSeen) >= cutoff))
    .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
}
