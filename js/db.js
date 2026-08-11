import {
  collection,
  addDoc,
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  increment,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-init.js";

// ---------- Diller (languages) ----------

export function listenLanguages(cb) {
  const q = query(collection(db, "languages"), orderBy("createdAt", "asc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function addLanguage(name, emoji) {
  return addDoc(collection(db, "languages"), {
    name: name.trim(),
    emoji: emoji || "🌐",
    createdAt: serverTimestamp()
  });
}

export async function deleteLanguage(langId) {
  // Alt koleksiyondaki kelimeleri de temizle
  const wordsSnap = await getDocs(collection(db, "languages", langId, "words"));
  const batch = writeBatch(db);
  wordsSnap.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, "languages", langId));
  await batch.commit();
}

// ---------- Kelimeler (words) ----------

export function listenWords(langId, cb) {
  const q = query(collection(db, "languages", langId, "words"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function addWord(langId, { word, meaning, example }) {
  return addDoc(collection(db, "languages", langId, "words"), {
    word: word.trim(),
    meaning: (meaning || "").trim(),
    example: (example || "").trim(),
    createdAt: serverTimestamp(),
    correctCount: 0,
    wrongCount: 0
  });
}

export async function updateWord(langId, wordId, data) {
  return updateDoc(doc(db, "languages", langId, "words", wordId), data);
}

export async function deleteWord(langId, wordId) {
  return deleteDoc(doc(db, "languages", langId, "words", wordId));
}

export async function getWordsOnce(langId) {
  const snap = await getDocs(collection(db, "languages", langId, "words"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function recordQuizResult(langId, wordId, correct) {
  return updateDoc(doc(db, "languages", langId, "words", wordId), {
    [correct ? "correctCount" : "wrongCount"]: increment(1)
  });
}
