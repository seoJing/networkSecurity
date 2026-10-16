/** Normal baseline session policy: advanced checks belong to the defender. */
export interface SessionContext {
  userId: number;
  sourceIp: string;
  userAgent: string;
}

export interface SessionPolicy {
  validate(context: SessionContext): boolean | Promise<boolean>;
}

export const baselinePolicy: SessionPolicy = {
  validate({ userId }) {
    return Number.isSafeInteger(userId) && userId > 0;
  },
};
