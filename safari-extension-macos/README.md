# Safari macOS Project

Bu klasor, `browser-extension/` icindeki video-site odakli uzantinin macOS Safari icin tasinmis Xcode projesini icerir.

## Proje

Acilacak dosya:

```text
safari-extension-macos/Subtitle Hover Translator for Mac/Subtitle Hover Translator for Mac.xcodeproj
```

Target'lar:

- `Subtitle Hover Translator for Mac`
- `Subtitle Hover Translator for Mac Extension`

## Ne saglar

- macOS Safari icinde calisan web extension
- Video sitelerinde altyazi metni ustunde kelime ve secim cevirisi
- Bilinmeyenleri uzanti storage'inda tutma
- Mac uygulamasi icinde Safari etkinlestirme yonlendirmesi

## Kurulum

1. Xcode ile projeyi ac
2. `Signing & Capabilities` altindan kendi Apple `Team` bilginizi sec
3. Gerekirse bundle identifier'lari kendi hesabiniz icin degistirin
4. `Subtitle Hover Translator for Mac` uygulama target'ini secin
5. Run alin

## Safari'de etkinlestirme

1. Uygulama acildiktan sonra Safari ayarlarini acin
2. `Extensions` bolumune gidin
3. `Subtitle Hover Translator for Mac` uzantisini etkinlestirin
4. Gerekirse desteklenen siteler icin izin verin

## macOS otomasyon

Safari ayar penceresini acip uzanti secimini otomatiklestirmek icin:

```bash
./scripts/run_macos_extension_automation.sh
```

Bu script:

- macOS Safari projesini Debug olarak derler
- normal signing akisi `Mac Development` hatasina duserse unsigned build alip bundle'i yerelde `Apple Development` identity ile yeniden imzalar
- uzantiyi `pluginkit` uzerinden `use` durumuna alir
- container app'i `--open-safari-extension-preferences` argumaniyla acip Safari ayarlarina yonlendirir
- erisilebilirlik izni aciksa Safari icindeki ilgili checkbox'i tiklamaya calisir

Not:

- `System Events` erisilebilirlik izni kapaliysa script durumu yazar ve Safari ayar penceresini acik birakir
- ilk kez GUI automation kullanacaksaniz `Sistem Ayarlari > Gizlilik ve Guvenlik > Erisilebilirlik` icinde Codex veya Terminal icin izin vermeniz gerekir
- fallback imzalama icin login keychain icinde en az bir `Apple Development` sertifikasi bulunmalidir
- Safari listesinde uzanti hic gorunmuyorsa Xcode projesinde `Signing & Capabilities > Team` bos kaliyor olabilir; bu durumda build `Sign to Run Locally` ile gecer ama Safari uzantiyi listelemez

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

- `Subtitle Hover Translator for Mac Extension/Resources/manifest.json`
- `Subtitle Hover Translator for Mac Extension/Resources/content.js`
- `Subtitle Hover Translator for Mac Extension/Resources/background.js`
- `Subtitle Hover Translator for Mac Extension/Resources/popup.*`

Kaynak uzanti:

- [browser-extension](/Users/yasinkaya/Library/Mobile%20Documents/com~apple~Keynote/Documents/k%C4%B1z%C4%B1l%20o%CC%88tesi%20ve%20normal%20go%CC%88ru%CC%88ntu%CC%88%20is%CC%A7leme/altayz%C4%B1%20tool/browser-extension)

## Dogrulanan durum

- `xcodebuild` ile macOS Debug build gecti
- Mac uygulamasi yerelde acildi
- `pluginkit -e use` ile uzanti kullanici secimi `+ use` durumuna alindi

Kullanilan komut:

```bash
xcodebuild -project 'safari-extension-macos/Subtitle Hover Translator for Mac/Subtitle Hover Translator for Mac.xcodeproj' \
  -scheme 'Subtitle Hover Translator for Mac' \
  -configuration Debug \
  -derivedDataPath /tmp/sht-macos-derived-data \
  build
```

## Sinir

Bu paket macOS Safari icindir. Diger tarayicilarda calismaz; sistem geneli overlay saglamaz.
