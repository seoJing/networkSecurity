/** Normal baseline session policy: advanced checks belong to the defender. */
export interface SessionContext {
  userId: number;
  sourceIp: string;
  userAgent: string;
  // Baseline captured at login (defender contract extension). Undefined for sessions issued before it.
  boundIp?: string;
  boundUa?: string;
}

export interface SessionPolicy {
  validate(context: SessionContext): boolean | Promise<boolean>;
}

export const baselinePolicy: SessionPolicy = {
  validate({ userId }) {
    return Number.isSafeInteger(userId) && userId > 0;
  },
};
