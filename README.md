# Altyazi Ustunde Ceviri Tool

Bu repo, video sitelerindeki altyazi overlay'lerinde ve normal web sayfalarindaki gorunur metinde calisan ceviri aracinin uc paketini icerir:

- `browser-extension/`: Chrome ve Chromium uzantisi
- `safari-extension/`: iPhone ve iPad icin Safari Web Extension Xcode projesi
- `safari-extension-macos/`: macOS icin Safari Web Extension Xcode projesi

Yerel gelistirme ve fixture dosyalari da ayrica repoda tutulur:

- `server.js`
- `public/`
- `data/unknown-words.json`

## Hedef

Video sitelerindeki altyazi metni ve normal web metni ustunde:

- kelime icin anlik ceviri
- secili satir veya cumle icin toplu ceviri
- bilinmeyen kelime veya cumleyi anlamiyla kaydetme
- video sitelerinde player kontrollerini gereksiz yere tetiklemeden hover etme

## Calisma kapsami

- Tum normal web siteleri icin genel metin modu
- YouTube, Netflix, Prime Video, Disney+, Max, Udemy ve Twitch icin odak video overlay modu

Bilinen subtitle selector'lari once denenir. Eslesme olmazsa, oynatilan video civarindaki gorunur altyazi benzeri DOM icin fallback kullanilir. Video olmayan sayfalarda ise genel web metni heuristics'i devreye girer.

## Chrome veya Chromium kurulumu

1. `chrome://extensions` ac
2. `Developer mode` ac
3. `Load unpacked` sec
4. `browser-extension/` klasorunu yukle

Detaylar:

- [browser-extension/README.md](/Users/yasinkaya/Library/Mobile%20Documents/com~apple~Keynote/Documents/k%C4%B1z%C4%B1l%20o%CC%88tesi%20ve%20normal%20go%CC%88ru%CC%88ntu%CC%88%20is%CC%A7leme/altayz%C4%B1%20tool/browser-extension/README.md)

## iPhone ve iPad Safari kurulumu

1. Xcode ile [Subtitle Hover Translator.xcodeproj](/Users/yasinkaya/Library/Mobile%20Documents/com~apple~Keynote/Documents/k%C4%B1z%C4%B1l%20o%CC%88tesi%20ve%20normal%20go%CC%88ru%CC%88ntu%CC%88%20is%CC%A7leme/altayz%C4%B1%20tool/safari-extension/Subtitle%20Hover%20Translator/Subtitle%20Hover%20Translator.xcodeproj) projesini ac
2. Kendi `Team` bilginizi sec
3. `Subtitle Hover Translator` uygulama target'ini iPhone, iPad veya simulator icin calistir
4. iPhone veya iPad'de Safari uzantilarini acip `Subtitle Hover Translator` uzantisini etkinlestir
5. Safari icinde video overlay veya normal web metni ustunde kullan

Detaylar:

- [safari-extension/README.md](/Users/yasinkaya/Library/Mobile%20Documents/com~apple~Keynote/Documents/k%C4%B1z%C4%B1l%20o%CC%88tesi%20ve%20normal%20go%CC%88ru%CC%88ntu%CC%88%20is%CC%A7leme/altayz%C4%B1%20tool/safari-extension/README.md)

Simulator'da Safari > Uzantilar adimini otomatiklestirmek icin:

```bash
./scripts/run_ios_extension_automation.sh
```

Bu komut simulator'u boot eder, iOS Safari paketini temiz kurar ve XCUITest ile `Settings > Apps > Safari > Extensions > Subtitle Hover Translator` akisini tamamlayip uzantiyi acmaya calisir.
Isterseniz hedef simulator adini arguman olarak verip iPad icin de calistirabilirsiniz: `./scripts/run_ios_extension_automation.sh 'iPad (A16)'`.

## macOS Safari kurulumu

1. Xcode ile [Subtitle Hover Translator for Mac.xcodeproj](/Users/yasinkaya/Library/Mobile%20Documents/com~apple~Keynote/Documents/k%C4%B1z%C4%B1l%20o%CC%88tesi%20ve%20normal%20go%CC%88ru%CC%88ntu%CC%88%20is%CC%A7leme/altayz%C4%B1%20tool/safari-extension-macos/Subtitle%20Hover%20Translator%20for%20Mac/Subtitle%20Hover%20Translator%20for%20Mac.xcodeproj) projesini ac
2. Kendi `Team` bilginizi sec
3. `Subtitle Hover Translator for Mac` uygulama target'ini calistir
4. Safari Settings > Extensions icinde uzantiyi etkinlestir
5. Safari icinde video overlay veya normal web metni ustunde kullan

Detaylar:

- [safari-extension-macos/README.md](/Users/yasinkaya/Library/Mobile%20Documents/com~apple~Keynote/Documents/k%C4%B1z%C4%B1l%20o%CC%88tesi%20ve%20normal%20go%CC%88ru%CC%88ntu%CC%88%20is%CC%A7leme/altayz%C4%B1%20tool/safari-extension-macos/README.md)

macOS'ta Safari etkinlestirme adimini otomatiklestirmek icin:

```bash
./scripts/run_macos_extension_automation.sh
```

Bu komut macOS Safari projesini derler, `pluginkit` uzerinden uzantiyi `use` durumuna alir, container app ile Safari ayar penceresini acar ve GUI scripting izni varsa uzanti checkbox'ini tiklamaya calisir.
Gerekirse `Mac Development` hatasini atlatmak icin unsigned build + local `Apple Development` codesign fallback'i kullanir.

## Yerel test ortami

```bash
npm start
```

Sonra:

- `http://localhost:3000`
- `http://localhost:3000/mock-video-sites.html?shtSite=youtube`
- `http://localhost:3000/mock-generic-site.html`

Ikinci adres, YouTube benzeri caption DOM fixture'i verir. Ucuncu adres genel web metni hover ve secim akisini test etmek icin kullanilir.

## Dogrulanan durum

- Chrome uzantisi yukleniyor
- destekli video host profili algilaniyor
- normal web sayfasinda genel metin modu acilabiliyor
- hover cevirisi geliyor
- selection cevirisi geliyor
- bilinmeyen kaydi storage'a yaziliyor
- iOS Safari Xcode projesi simulator icin derleniyor
- iOS container app simulator'da kurulup aciliyor
- iOS simulator'da Safari uzantisi XCUITest ile etkinlestiriliyor
- macOS Safari Xcode projesi derleniyor
- macOS container app aciliyor
- macOS uzantisi `pluginkit` uzerinden `+ use` durumuna alinabiliyor
