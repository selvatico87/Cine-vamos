import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import { sanitizeFavoritePayload } from '../utils/movieHelpers';

const FirebaseContext = createContext(null);

export function FirebaseProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    localStorage.removeItem('favs');

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);

      if (firebaseUser && firebaseUser.emailVerified) {
        const userPath = `users/${firebaseUser.uid}`;
        try {
          const profileData = {
            uid: firebaseUser.uid,
            displayName: (firebaseUser.displayName || 'Cinéfilo').slice(0, 120),
            updatedAt: serverTimestamp(),
          };
          if (firebaseUser.email) {
            profileData.email = firebaseUser.email.slice(0, 254);
          }
          if (firebaseUser.photoURL) {
            profileData.photoURL = firebaseUser.photoURL.slice(0, 512);
          }
          await setDoc(doc(db, 'users', firebaseUser.uid), profileData, { merge: true });
        } catch (error) {
          try {
            handleFirestoreError(error, OperationType.WRITE, userPath);
          } catch (wrapped) {
            console.error(wrapped);
          }
        }
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady) return undefined;

    if (!user) {
      setFavorites([]);
      return undefined;
    }

    const favsPath = `users/${user.uid}/favorites`;
    const favsQuery = query(
      collection(db, 'users', user.uid, 'favorites'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      favsQuery,
      (snapshot) => {
        const nextFavs = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: data.movieId,
            title: data.title,
            imgURL: data.imgURL,
          };
        });
        setFavorites(nextFavs);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, favsPath);
        } catch (wrapped) {
          console.error(wrapped);
        }
      }
    );

    return () => unsubscribe();
  }, [authReady, user]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError('');
    setAuthLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (error) {
      let message = 'No se pudo iniciar sesión con Google.';
      if (error?.code === 'auth/popup-closed-by-user') {
        message = 'Se cerró la ventana de acceso antes de completar el inicio de sesión.';
      } else if (error?.code === 'auth/popup-blocked') {
        message = 'El navegador bloqueó la ventana emergente de Google. Permite ventanas emergentes e inténtalo de nuevo.';
      } else if (error?.code === 'auth/unauthorized-domain') {
        message = 'Este dominio aún no está autorizado en Firebase Auth para iniciar sesión con Google.';
      } else if (error?.message) {
        message = error.message;
      }
      setAuthError(message);
      throw error;
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setAuthError('');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    if (auth.currentUser) {
      await signOut(auth);
    }
  }, []);

  const toggleFavorite = useCallback(
    async (movieData) => {
      const movieId = parseInt(movieData?.id ?? movieData?.movieId, 10);
      if (!Number.isInteger(movieId) || movieId <= 0) return;

      let activeUser = user;
      if (!activeUser) {
        try {
          activeUser = await signInWithGoogle();
        } catch {
          return;
        }
      }
      if (!activeUser || !activeUser.emailVerified) return;

      const exists = favorites.some((fav) => fav.id === movieId);
      const docPath = `users/${activeUser.uid}/favorites/${movieId}`;
      try {
        if (exists) {
          await deleteDoc(doc(db, 'users', activeUser.uid, 'favorites', String(movieId)));
        } else {
          const sanitized = sanitizeFavoritePayload(movieData, activeUser.uid);
          await setDoc(doc(db, 'users', activeUser.uid, 'favorites', String(movieId)), {
            ...sanitized,
            createdAt: serverTimestamp(),
          });
        }
      } catch (error) {
        handleFirestoreError(error, exists ? OperationType.DELETE : OperationType.WRITE, docPath);
      }
    },
    [favorites, signInWithGoogle, user]
  );

  const isAuthenticated = Boolean(user);

  return (
    <FirebaseContext.Provider
      value={{
        user,
        authReady,
        authLoading,
        authError,
        setAuthError,
        isAuthenticated,
        favorites,
        signInWithGoogle,
        logout,
        toggleFavorite,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase() {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebase debe usarse dentro de un FirebaseProvider.');
  }
  return ctx;
}
