import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
googleAuthProvider.addScope('https://www.googleapis.com/auth/chat.spaces.readonly');
googleAuthProvider.addScope('https://www.googleapis.com/auth/chat.messages.readonly');
googleAuthProvider.addScope('https://www.googleapis.com/auth/chat.messages.create');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onUserChange: (user: User | null, accessToken: string | null) => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (!isSigningIn) {
        onUserChange(user, cachedAccessToken);
      }
    } else {
      cachedAccessToken = null;
      onUserChange(null, null);
    }
  });
};

export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string | null;
  idToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleAuthProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken ?? null;
    const idToken = await result.user.getIdToken();
    return {
      user: result.user,
      accessToken: cachedAccessToken,
      idToken,
    };
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => cachedAccessToken;

export const getIdToken = async (): Promise<string | null> => {
  if (!auth.currentUser) return null;
  return await auth.currentUser.getIdToken();
};

export const logout = async () => {
  cachedAccessToken = null;
  await auth.signOut();
};

export const firebaseProjectId = firebaseConfig.projectId;
