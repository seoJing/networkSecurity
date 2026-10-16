import { baselinePolicy, type SessionPolicy } from '../sessionPolicy';

/** Defender extension point. Keep baseline behavior and normal-user tests intact. */
export const activeSessionPolicy: SessionPolicy = baselinePolicy;
