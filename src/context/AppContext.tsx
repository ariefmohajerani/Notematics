import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signInWithPopup, signOut } from 'firebase/auth';
import { collection, onSnapshot, query, where, orderBy, DocumentData } from 'firebase/firestore';
import { auth, googleProvider, db } from '../services/firebase/config';
import { tokenService, TokenStatus } from '../services/token_manager/tokenService';

interface Note extends DocumentData {
  id: string;
  title: string;
  content: string;
  updatedAt: any;
}

interface AppContextType {
  user: User | null;
  authLoading: boolean;
  notes: Note[];
  notesLoading: boolean;
  tokenStatus: TokenStatus | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [notes, setNotes] = useState<Note[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAuthLoading(false);
      if (u) {
        const status = await tokenService.getStatus();
        setTokenStatus(status);
      } else {
        setTokenStatus(null);
        setNotes([]);
      }
    });
    return unsubscribe;
  }, []);

  // Sync Notes Globally
  useEffect(() => {
    if (!user) {
      setNotesLoading(false);
      return;
    }
    
    setNotesLoading(true);
    const q = query(
      collection(db, 'notes'),
      where('userId', '==', user.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Note[];
      setNotes(list);
      setNotesLoading(false);
    });

    return unsubscribe;
  }, [user]);

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      console.error("Login failed", e);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const refreshTokens = async () => {
    if (user) {
      const status = await tokenService.getStatus();
      setTokenStatus(status);
    }
  };

  return (
    <AppContext.Provider value={{ user, authLoading, notes, notesLoading, tokenStatus, login, logout, refreshTokens }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppContext must be used within AppProvider");
  return context;
};
