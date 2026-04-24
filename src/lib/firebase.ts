import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'user' | 'admin';
  createdAt: any;
  isAdminVerified?: boolean;
}

export interface Registration {
  id?: string;
  sectionId: string;
  name: string;
  isHelping: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface Report {
  id?: string;
  userId: string;
  userName: string;
  sectionId: string;
  contentText: string;
  voiceUrl?: string;
  script?: string;
  imageUrl?: string;
  status: 'pending' | 'approved' | 'good' | 'rejected';
  reviewerId?: string;
  fileName?: string;
  fileData?: string;
  createdAt: any;
}
