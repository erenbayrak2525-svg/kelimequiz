# Kelime Defteri

Kelime çalışmak için basit, PWA uyumlu, Firebase destekli kişisel bir kelime defteri.

- Sol menüden dil ekleyip her dile ayrı kelime listesi tutabilirsin
- Her kelimeye anlam ve kullanım örneği ekleyebilirsin — elle ya da Gemini (Google AI Studio) ile otomatik
- Sol menüden dil seçip çoktan seçmeli kelime quizi yapabilirsin
- Telefona/bilgisayara "uygulama gibi" kurulabilir (PWA), internet olmadan da açılır (veri senkronu için internet gerekir)

Herhangi bir build aracı (Vite, npm, vs.) gerekmez — düz HTML/CSS/JS. GitHub Pages'te doğrudan çalışır.

---

## 1) Firebase projesi kurulumu

1. https://console.firebase.google.com adresine git, **Add project** ile yeni proje oluştur.
2. Sol menüden **Build → Firestore Database** → **Create database** → production mode (kurallar aşağıda) → bir bölge seç.
3. Sol menüden **Build → Authentication** → **Get started** → **Sign-in method** sekmesinden **Anonymous** sağlayıcısını aktif et.
   - Bu uygulama seni tanımlamak için hesap/şifre istemiyor; tarayıcıya sessizce anonim bir kimlik atanıyor. Aşağıdaki güvenlik kuralıyla bu kimliği sadece sana kilitliyoruz.
4. Proje ayarları (dişli ikonu) → **Project settings** → **Your apps** → **</> (Web)** ikonuyla yeni bir web app kaydet (Firebase Hosting'i işaretlemene gerek yok).
5. Sana verilen `firebaseConfig` nesnesini kopyala, `js/firebase-config.js` dosyasındaki alanların yerine yapıştır.

> Not: Bu config değerleri (`apiKey`, `projectId` vb.) gizli anahtar değildir, Firebase web uygulamalarında tarayıcıda görünmeleri normaldir. Bunları GitHub'a göndermekte sakınca yok. Asıl koruma bir sonraki adımdaki **Firestore kuralları**.

## 2) Firestore güvenlik kuralları

Firestore → **Rules** sekmesine git, önce şu basit kuralla başla (herkesin anonim girişi kabul ama sadece giriş yapmış biri okur/yazar):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Bunu yayınla, siteyi bir kere aç (otomatik anonim giriş yapılacak), sonra **Ayarlar** sayfasına git — orada senin anonim kullanıcı ID'n (`uid`) yazacak. O ID'yi kopyalayıp kuralı şuna güncelle (artık sadece SEN erişebilirsin, başka biri linki bulsa bile giremez):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == "BURAYA_KENDI_UID_INI_YAPISTIR";
    }
  }
}
```

## 3) Gemini (yapay zeka) API anahtarı

1. https://aistudio.google.com/apikey adresinden ücretsiz bir API anahtarı oluştur.
2. Uygulamayı aç → sol menü → **Ayarlar** → anahtarı yapıştır → **Kaydet**.
3. Bu anahtar sadece senin tarayıcında (`localStorage`) saklanır. Koda gömülmez, GitHub'a gitmez, Firestore'a da yazılmaz. Başka bir cihazdan girersen orada da ayrıca girmen gerekir.

Kullanılan model `js/ai.js` içinde `MODEL` sabitinde tanımlı (`gemini-2.5-flash`). Google model isimlerini zamanla değiştirebiliyor; "AI isteği başarısız oldu" hatası alırsan Google AI Studio'dan güncel model adını kontrol edip bu satırı güncelle.

## 4) Yerelde test etme

Tarayıcılar `file://` üzerinden ES module + service worker çalıştırmaz, basit bir local server gerekir:

```bash
cd vocab-pwa
python3 -m http.server 8080
# veya: npx serve .
```

Sonra `http://localhost:8080` adresini aç.

## 5) GitHub'a atma ve GitHub Pages ile yayınlama

```bash
cd vocab-pwa
git init
git add .
git commit -m "İlk sürüm"
git branch -M main
git remote add origin https://github.com/KULLANICI_ADIN/REPO_ADIN.git
git push -u origin main
```

GitHub'da repo → **Settings → Pages** → **Source: Deploy from a branch** → Branch: `main`, klasör: `/ (root)` → **Save**.

Birkaç dakika sonra site şu adreste yayında olur:
`https://KULLANICI_ADIN.github.io/REPO_ADIN/`

> `manifest.json` ve `sw.js` içindeki tüm yollar göreli (`./...`) yazıldı, bu yüzden repo adı ne olursa olsun (alt klasörde yayınlansa bile) sorunsuz çalışır.

## 6) Telefona/bilgisayara kurma (PWA)

- **Android/Chrome:** siteyi aç → sağ üstteki ⋮ menü → **Uygulamayı yükle**.
- **iPhone/Safari:** siteyi aç → paylaş ikonu → **Ana Ekrana Ekle**.
- **Masaüstü Chrome:** adres çubuğunun sağındaki kurulum ikonuna tıkla.

---

## Klasör yapısı

```
vocab-pwa/
├── index.html
├── manifest.json
├── sw.js                  ← service worker (offline önbellek)
├── css/style.css
├── js/
│   ├── firebase-config.js ← kendi Firebase config'ini buraya yapıştır
│   ├── firebase-init.js   ← Firebase başlatma + anonim giriş
│   ├── db.js               ← Firestore okuma/yazma fonksiyonları
│   ├── ai.js                ← Gemini API çağrıları
│   └── app.js               ← arayüz, yönlendirme, tüm ekranlar
└── icons/
```

## Veri modeli (Firestore)

```
languages/{langId}
  name, emoji, createdAt

languages/{langId}/words/{wordId}
  word, meaning, example, createdAt, correctCount, wrongCount
```

## Bilinen sınırlamalar

- Quiz "kelimeyi gör, anlamını çoktan seçmeli bul" şeklinde. En az 2 kelimenin anlamı dolu olmalı, 4 kelime ve üzeri daha zengin seçenek sunar.
- Service worker sadece kendi dosyalarını (app kabuğu) önbelleğe alır; Firestore verileri gerçek zamanlı senkron olduğu için internet gerektirir.
- Gemini anahtarı tarayıcı bazlıdır — farklı cihazda tekrar girmen gerekir.
