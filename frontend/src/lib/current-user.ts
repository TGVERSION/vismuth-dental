
import type { ServiceUserData } from '@/api';

export const mergeCurrentUser = (
  stored: ServiceUserData,
  me: ServiceUserData,
): ServiceUserData => ({ ...stored, ...me, id: stored.id });
