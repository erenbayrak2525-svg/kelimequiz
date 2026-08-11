import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});

// authState: her auth değişikliğinde çağrılan dinleyicileri app.js besler
const listeners = [];
export function onAuthChange(cb) {
  listeners.push(cb);
  cb(auth.currentUser);
  return onAuthStateChanged(auth, (user) => {
    listeners.forEach((l) => l(user));
  });
}

export function login(email, password) {
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

export function logout() {
  return signOut(auth);
}

export function currentUid() {
  return auth.currentUser ? auth.currentUser.uid : null;
}

export function currentEmail() {
  return auth.currentUser ? auth.currentUser.email : null;
}
