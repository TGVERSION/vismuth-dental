'use client';

import { useEffect, useState } from 'react';
import {
  userMembershipApi,
  type MembershipRoleOption,
} from '@/api/user-membership-api';

export function useStaffRoles() {
  const [roles, setRoles] = useState<MembershipRoleOption[]>([]);
  useEffect(() => {
    let live = true;
    userMembershipApi
      .staffRoles()
      .then((items) => {
        if (live) setRoles(items);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return roles;
}
