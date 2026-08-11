// Firebase projenin "Web app" ayarlarından kopyalayacağın config burası.
// Firebase konsolu: Project settings > General > Your apps > SDK setup and configuration
//
// NOT: Bu değerler "gizli anahtar" değildir, Firebase web config'i tarayıcıda
// zaten görünür olacak şekilde tasarlanmıştır. Güvenlik, Firestore
// Security Rules ile sağlanır (bkz. README.md). Bu dosyayı GitHub'a
// göndermekte sakınca yoktur.

export const firebaseConfig = {
  apiKey: "BURAYA_API_KEY",
  authDomain: "BURAYA_PROJE.firebaseapp.com",
  projectId: "BURAYA_PROJE",
  storageBucket: "BURAYA_PROJE.appspot.com",
  messagingSenderId: "BURAYA_SENDER_ID",
  appId: "BURAYA_APP_ID"
};
