'use client';

import { createContext, useContext } from 'react';
import { PERCER_ROLES } from '@/lib/constants';

const UserContext = createContext(null);

export function UserProvider({ user, children }) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

// Utilisateur courant, fourni par le layout serveur (jamais de secret ici)
export function useUser() {
  return useContext(UserContext);
}

export function useIsPercer() {
  const user = useContext(UserContext);
  return !!user && PERCER_ROLES.includes(user.role);
}
