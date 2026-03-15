# Subtitle Hover

[![Platform - Chrome](https://img.shields.io/badge/Platform-Chrome-orange.svg)](https://chrome.google.com/webstore)
[![Platform - Safari iOS](https://img.shields.io/badge/Platform-Safari_iOS-blue.svg)](https://apple.com/safari)
[![Platform - Safari macOS](https://img.shields.io/badge/Platform-Safari_macOS-blue.svg)](https://apple.com/safari)

**Subtitle Hover**, yabancı dilde video izlemeyi ve web sayfalarında okuma yapmayı bir öğrenme serüvenine dönüştüren, akıllı ve profesyonel bir çeviri asistanıdır. YouTube, Netflix, Disney+ gibi dev platformlarda altyazıların üzerine gelerek anında çeviri almanızı sağlar.

---

## 🛠️ Kurulum Rehberi (Adım Adım)

### 1. Hazırlık (Tüm Platformlar İçin)
Projenin çalışması için bilgisayarınızda **Node.js** yüklü olmalıdır.
1. [nodejs.org](https://nodejs.org/) adresinden LTS sürümünü indirin ve kurun.
2. Terminali (veya komut satırını) açın ve proje klasörüne gidin:
   ```bash
   cd ~/Desktop/subtitle-hover
   npm install
   ```

---

### 2. Chrome / Brave / Edge Kurulumu
1. Tarayıcınızda `chrome://extensions` adresine gidin.
2. Sağ üst köşedeki **Geliştirici Modu (Developer Mode)** seçeneğini aktif hale getirin.
3. Sol üstteki **Paketlenmemiş öğe yükle (Load unpacked)** butonuna tıklayın.
4. Açılan pencerede `Desktop/subtitle-hover/src/extension` klasörünü seçin.
5. Uzantı ikonunu tarayıcı çubuğuna sabitleyin.

---

### 3. macOS Safari Kurulumu
1. Bilgisayarınızda **Xcode** yüklü olmalıdır (App Store'dan indirebilirsiniz).
2. `platforms/safari-macos/Subtitle Hover Translator for Mac/Subtitle Hover Translator for Mac.xcodeproj` dosyasını Xcode ile açın.
3. Xcode'un üst kısmında "Subtitle Hover (macOS)" target'ının seçili olduğundan emin olun.
4. **Signing & Capabilities** sekmesinden kendi Apple hesabınızı (Team) seçin.
5. "Run" (Oynat butonu) tıklayın. Uygulama açılacaktır.
6. **Safari > Ayarlar > Uzantılar** menüsüne gidin ve "Subtitle Hover (macOS)" seçeneğini işaretleyin.

---

### 4. iPhone / iPad Safari Kurulumu
1. iPhone/iPad'inizi Mac'inize bağlayın.
2. `platforms/safari-ios/Subtitle Hover Translator/Subtitle Hover Translator.xcodeproj` dosyasını Xcode ile açın.
3. Apple hesabınızı (Team) seçin.
4. Target olarak bağlı olan cihazınızı seçin ve "Run" butonuna basın.
5. Cihazınızda **Ayarlar > Safari > Uzantılar** yolunu izleyin ve "Subtitle Hover (iOS)"u etkinleştirin.

---

## 🎮 Nasıl Kullanılır?

### Temel Kullanım Senaryosu
1. **Video İzlerken:** Herhangi bir YouTube veya Netflix videosu açın. Altyazıların üzerine mouse (veya parmağınızla) gelin. Birkaç milisaniye içinde kelimenin çevirisi, eş anlamlıları ve tanımı içeren şık bir kart açılacaktır.
2. **Web Okuması Yaparken:** Haber sitelerinde veya bloglarda bilinmeyen bir kelimenin üzerine gelin.
3. **Seçili Çeviri:** Eğer tek bir kelime değil de bir deyimi merak ediyorsanız, o bölümü mouse ile seçin (drag selection). Sistem otomatik olarak tüm ifadeyi çevirecektir.

### Kısayol Tuşları (Sadece Masaüstü)
Kart açıkken şu tuşları kullanabilirsiniz:
- **`S` Tuşu (Save):** Kelimeyi anında "Bilinmeyenler" listesine kaydeder.
- **`P` Tuşu (Pin):** Kartı ekrana sabitler. Mouse'u çekseniz bile kart kapanmaz, incelemeye devam edebilirsiniz.
- **`Esc` Tuşu:** Kartı anında kapatır.

---

## 🏛️ Mimari ve Dosya Yapısı

Proje, **Clean Architecture** prensipleriyle yapılandırılmıştır:

- **`src/extension/`**: Tüm tarayıcılarda çalışan ortak akıllı motor ve arayüz dosyaları.
- **`platforms/`**: Safari'nin iOS ve macOS sürümleri için gerekli olan sistem dosyaları ve Xcode projeleri.
- **`tools/mock-server/`**: Geliştiriciler için yerel test platformu.
- **`sync.sh`**: Yapılan her değişikliği anında tüm platformlara dağıtan kritik otomasyon scripti.

---

## 🛰️ İletişim & Destek

Geliştiren: **Mehmet Yasin Kaya**  
E-posta: [gs7016903@gmail.com](mailto:gs7016903@gmail.com)  
Platform: [GitHub](https://github.com/yasinkaya701)

---
*Subtitle Hover ile öğrenmek artık bir angarya değil, bir zevk.*
