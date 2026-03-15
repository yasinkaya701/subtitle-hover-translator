# Safari iOS Project

Bu klasor, `browser-extension/` icindeki video-site odakli uzantinin iPhone ve iPad Safari icin tasinmis Xcode projesini icerir.

## Proje

Acilacak dosya:

```text
safari-extension/Subtitle Hover Translator/Subtitle Hover Translator.xcodeproj
```

Target'lar:

- `Subtitle Hover Translator`
- `Subtitle Hover Translator Extension`

## Ne saglar

- iPhone ve iPad ustunde Safari icinde calisan web extension
- Video sitelerinde altyazi metni ustunde kelime ve secim cevirisi
- touch cihazlarda uzun basinca tek kelime, uzun basip surukleyince 2-3 kelimelik secim cevirisi
- Bilinmeyenleri uzanti storage'inda tutma
- iOS container app icinde kurulum yonlendirmesi

## Kurulum

1. Xcode ile projeyi ac
2. `Signing & Capabilities` altindan kendi Apple `Team` bilginizi sec
3. Gerekirse bundle identifier'lari kendi hesabiniz icin degistirin
4. `Subtitle Hover Translator` uygulama target'ini secin
5. iPhone, iPad veya iOS Simulator hedefi secin
6. Run alin

## Safari'de etkinlestirme

1. Uygulama cihaza kurulduktan sonra iPhone veya iPad'de Safari uzanti ayarlarina gidin
2. `Subtitle Hover Translator` uzantisini etkinlestirin
3. Gerekirse izin verilecek siteleri onaylayin
4. Safari'de desteklenen video sitesini acin

Etkilesim:

- iPad + mouse/trackpad: fareyi kelimenin ustune goturun
- iPhone/iPad touch: kelime ustunde uzun basin
- iPhone/iPad touch secim: uzun basip diger kelimelere surukleyin

## Simulator otomasyonu

Simulator icin Safari > Uzantilar adimi XCUITest ile otomatiklestirildi.

Komut:

```bash
./scripts/run_ios_extension_automation.sh
```

iPad simulator icin:

```bash
./scripts/run_ios_extension_automation.sh 'iPad (A16)'
```

Yaptigi is:

- `Subtitle Hover Translator` i temiz kurar
- iOS app ve Safari extension bundle'ini simulator'a kurar
- container app'i bir kez acip kaydeder
- `Settings > Apps > Safari > Extensions > Subtitle Hover Translator` akisini otomatik gezer
- `Genisletmeye Izin Ver` anahtarini acmaya calisir

## Desteklenen odak siteler

- YouTube
- Netflix
- Prime Video
- Disney+
- Max
- Udemy
- Twitch

## Kaynaklar

Safari target'ina kopyalanan uzanti dosyalari:

- `Subtitle Hover Translator Extension/Resources/manifest.json`
- `Subtitle Hover Translator Extension/Resources/content.js`
- `Subtitle Hover Translator Extension/Resources/background.js`
- `Subtitle Hover Translator Extension/Resources/popup.*`
- `Subtitle Hover Translator Extension/Resources/icons/`

Kaynak uzanti:

- [browser-extension](/Users/yasinkaya/Library/Mobile%20Documents/com~apple~Keynote/Documents/k%C4%B1z%C4%B1l%20o%CC%88tesi%20ve%20normal%20go%CC%88ru%CC%88ntu%CC%88%20is%CC%A7leme/altayz%C4%B1%20tool/browser-extension)

## Dogrulanan durum

- `xcodebuild` ile iPhone/iPad simulator hedefi icin automation build gecti
- Uygulama simulator'a kurulup acildi
- `Subtitle Hover Translator Automation` scheme'i ile simulator'da Safari uzantisi acma testi gecti

Kullanilan komut:

```bash
xcodebuild -project 'safari-extension/Subtitle Hover Translator/Subtitle Hover Translator.xcodeproj' \
  -scheme 'Subtitle Hover Translator Automation' \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  -derivedDataPath /tmp/sht-derived-data \
  build-for-testing
```

## Sinir

Bu paket iPhone ve iPad Safari icindir. iOS'ta diger uygulamalarin ustunde sistem geneli overlay olarak calismaz.
