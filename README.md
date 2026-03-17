# Subtitle Hover

[![Platform - Chrome](https://img.shields.io/badge/Platform-Chrome-orange.svg)](https://chrome.google.com/webstore)
[![Platform - Safari iOS](https://img.shields.io/badge/Platform-Safari_iOS-blue.svg)](https://apple.com/safari)
[![Platform - Safari macOS](https://img.shields.io/badge/Platform-Safari_macOS-blue.svg)](https://apple.com/safari)

**Subtitle Hover**, yabancı dilde video izlemeyi ve web sayfalarında okuma yapmayı bir öğrenme serüvenine dönüştüren, akıllı ve profesyonel bir çeviri asistanıdır. YouTube, Netflix, Disney+ gibi dev platformlarda altyazıların üzerine gelerek anında çeviri almanızı sağlar.

---

## 🛠️ En Basit Kurulum Rehberi (Çok Kolay Anlatım)

Eklentiyi kullanmak için yazılımcı olmanıza gerek yok! Sadece aşağıdaki adımları sırayla takip edin.

### 1. Hazırlık (Lütfen Önce Bunu Yapın)
Bu dosyaları bilgisayarınızın tanıması için küçük bir program kurmamız gerekiyor.
*   **Adım 1:** [Şu Linke Tıklayın (nodejs.org)](https://nodejs.org/) ve açılan sayfadaki büyük yeşil butona (üzerinde **LTS** harfleri olan) tıklayıp programı indirin.
*   **Adım 2:** İnen "Node.js" programını, bilgisayarınıza herhangi bir program kurduğunuz gibi **"İleri (Next), İleri, İleri"** diyerek kurun.
*   **Adım 3:** Mac bilgisayarınızın sağ üstündeki büyüteç (Arama/Spotlight) simgesine tıklayın. Arama kutusuna **Terminal** yazın ve Enter'a basın. Siyah bir ekran açılacaktır.
*   **Adım 4:** Aşağıdaki kalın yazılı iki satırı kopyalayıp o siyah ekrana yapıştırın ve Enter'a basın:
    **`cd ~/Desktop/subtitle-hover`**
    *(Enter'a basın)*
    **`npm install`**
    *(Enter'a basın)*
*   *İnternet hızınıza göre siyah ekranda yazılar akacak, durduğunda hazırlık bitti demektir o ekranı kapatabilirsiniz.*

---

### 2. Google Chrome veya Edge İçin (En Kolay Yol)
Eğer internete Chrome veya benzeri bir tarayıcıdan giriyorsanız bunu yapın:
*   **Adım 1:** Chrome'u açın. En üstteki site adresi yazdığınız uzun çubuğun içine hiçbir şeye tıklamadan şunu yazıp Enter'a basın: **`chrome://extensions/`**
*   **Adım 2:** Açılan sayfanın sağ üst köşesinde **Geliştirici modu** adında küçük bir düğme göreceksiniz. Onu **Açık (Mavi)** hale getirin.
*   **Adım 3:** O düğmeyi açınca sol üstte yeni düğmeler belirecek. En soldaki **"Paketlenmemiş öğe yükle" (Load unpacked)** yazan butona tıklayın.
*   **Adım 4:** Masaüstünüze gidin. Sırasıyla şu klasörleri açın: **subtitle-hover -> src -> extension**.  
    *Dikkat: "extension" klasörünün İÇİNE GİRMEYİN. Sadece `extension` yazan klasörün üzerine bir kere tıklayıp onu seçin ve sağ alttaki **SEÇ** butonuna basın.*
*   **BİTTİ!** Sağ üst köşede bir yapboz parçası iconu göreceksiniz. Ona tıklayıp eklentiyi ekrana sabitleyin. Şimdi herhangi bir videoda altyazının üzerine farenizi götürün!

---

### 3. Mac Bilgisayarda Safari Kullanıyorsanız
Mac'in kendi tarayıcısı olan Safari bir tık daha nazlıdır, şu adımları yapmalısınız:
*   **Adım 1:** Mac'inizden **App Store**'a girin. Arama yerine **Xcode** yazın ve karşınıza çıkan uygulamayı indirin (Bu biraz büyüktür, inerken çay içebilirsiniz).
*   **Adım 2:** Masaüstündeki uygulamamızın klasörüne girin: `subtitle-hover -> platforms -> safari-macos -> Subtitle Hover Translator for Mac`.
*   **Adım 3:** Orada bulunan **`Subtitle Hover Translator for Mac.xcodeproj`** dosyasına iki kere tıklayıp demin indirdiğiniz Xcode ile açın.
*   **Adım 4:** Xcode açılınca ekranın tam ortasında `Signing & Capabilities` yazan yere tıklayın. Orada `Team` yazan bir liste göreceksiniz. Oradan kendi isminizi (Apple Hesabınızı) seçin.
*   **Adım 5:** Sol üst köşedeki, müzik çalarlardaki **Oynat (Run)** butonuna (Sağa bakan ok işareti) basın.
*   **BİTTİ!** Ekranda ufak bir pencere açıldıysa işlem tamam. Artık Safari tarayıcısını açıp **Safari Ayarları -> Uzantılar** bölümüne girerek bu eklentiyi işaretleyip aktif hale getirebilirsiniz.

---

### 4. iPhone Veya iPad İçin
Bu eklentiyi telefonunuzdaki Safari'ye de kurabilirsiniz:
*   **Adım 1:** Telefonunuzu şarj kablosuyla Mac bilgisayarınıza takın. (Telefon ekranında uyarı verirse 'Bu Bilgisayara Güven' deyin).
*   **Adım 2:** Masaüstündeki uygulamamızın klasörüne girin: `subtitle-hover -> platforms -> safari-ios -> Subtitle Hover Translator`.
*   **Adım 3:** Oradaki **`Subtitle Hover Translator.xcodeproj`** dosyasına iki kere tıklayıp Xcode ile açın.
*   **Adım 4:** Yukarıdan "kendi cep telefonunuzu" seçili hale getirin. (Örneğin: Ali'nin iPhone'u).
*   **Adım 5:** Tıpkı Mac kurulumundaki gibi `Signing & Capabilities` kısmından `Team` menüsüne tıklayıp kendi isminizi seçin.
*   **Adım 6:** Sol üstteki **Oynat (Run)** butonuna basın. Uygulama telefonunuza yüklenecek.
*   **BİTTİ!** Telefonunuza Subtitle Hover isimli bir uygulama gelmiş olacak. Daha sonra telefonunuzun **Ayarlar > Safari > Uzantılar** bölümüne girip, eklentiyi "Açık" hale getirin ve "İzin Ver" diyerek aktifleştirin.

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

---
## ⚖️ Lisans ve Telif Hakkı (License)

Tüm hakları saklıdır (All Rights Reserved). Bu projenin kaynak kodları, tasarımı ve iç mimarisi **Mehmet Yasin Kaya**'ya aittir.

Projeyi kopyalamak, değiştirmek, kendi adınıza yayınlamak veya ticari bir ürüne dönüştürmek **kesinlikle yasaktır**. Açık kaynaklı bir proje değildir, yalnızca dijital portfolyo veya inceleme amacıyla burada bulunmaktadır.

---

## 📬 İletişim & Destek

Geliştiren: **Mehmet Yasin Kaya**  
E-posta: [gs7016903@gmail.com](mailto:gs7016903@gmail.com)  
Platform: [GitHub](https://github.com/yasinkaya701)

---
*Subtitle Hover ile öğrenmek artık bir angarya değil, bir zevk.*
*(c) 2026 Mehmet Yasin Kaya. All Rights Reserved.*
