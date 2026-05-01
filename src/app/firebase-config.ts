// firebase-config.ts
// ID do app no Google Firebase: ao criar o projeto "petsphere-com-br" no console, substitua o bloco
// (apiKey, projectId, appId, etc.) coerentemente. Enquanto o app Web estiver vinculado ao projeto legado, mantenha estes campos.
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDpRqVdMO966X-e34c1KQJXRKlwzvzgV04",
  authDomain: "formulapet-com-br.firebaseapp.com",
  projectId: "formulapet-com-br",
  storageBucket: "formulapet-com-br.firebasestorage.app",
  messagingSenderId: "814626284746",
  appId: "1:814626284746:web:552698e044e1845f028033",
  measurementId: "G-5V2ZJ16LX6",
  /** Realtime Database — URL exata no console Firebase (Realtime DB). */
  databaseURL: "https://formulapet-com-br-default-rtdb.firebaseio.com"
};

// Aplicação principal (Auth, Firestore)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

/** Aplicação secundária: Auth + RTDB do suporte (custom token), sem substituir a sessão principal. */
const supportApp = getApps().find((a) => a.name === "supportChat")
  ? getApp("supportChat")
  : initializeApp(firebaseConfig, "supportChat");
export const supportAuth = getAuth(supportApp);
export const supportRtdb = getDatabase(supportApp);
/** Storage no mesmo app secundário (custom token) — anexos/áudio do chat parceiro. */
export const supportStorage = getStorage(supportApp);
