# Subtitle Hover Translator

`Subtitle Hover Translator`, video sitelerindeki altyazi overlay'lerinde ve normal web sayfalarindaki gorunur metinde calisan bir ceviri yardimcisidir.

Ana hedef:

- kelimenin ustune gelince aninda ceviri gostermek
- 2-3 kelime ya da tumce secilince toplu ceviri vermek
- bilinmeyen kelimeyi veya ifadeyi tek adimda kaydetmek
- ogrenme akisina donusturmek

Bu repo tek bir paketten ibaret degil. Ayni cekirdegin 3 farkli dagitimini icerir:

- `browser-extension/`: Chrome ve Chromium tabanli tarayicilar icin ana uzanti
- `safari-extension/`: iPhone ve iPad icin Safari Web Extension Xcode projesi
- `safari-extension-macos/`: macOS Safari icin Safari Web Extension Xcode projesi

Ek olarak repoda yerel test sunucusu, fixture sayfalari, smoke test script'leri ve paketleme araclari da bulunur.

## Ne saglar

Bu proje su anda asagidaki davranislari destekler:

- kelime hover cevirisi
- 2-3 kelimelik drag selection cevirisi
- altyazi ve normal web metni icin ayri davranis
- phrase / idiom tespiti
- detayli anlam, synonym, word formation ve source dictionary bilgisi
- example mode
- `S` ile quick save
- `P` ile pin
- `Esc` ile kapatma
- bilinmeyenler listesi
- mini review modu
- Anki TSV ve CSV export
- site profilleri
- Safari iOS ve Safari macOS paketleri

## Kisa urun ozeti

Kullanim mantigi su:

1. Kullanici video ya da normal web sayfasi acar.
2. Uzanti sayfadaki okunabilir metni bulur.
3. Video varsa once altyazi selector'larini ve video overlay fallback'lerini dener.
4. Kullanici kelimenin ustune gelir veya bir ifade secer.
5. Tooltip acilir.
6. Isterse kaydeder, sabitler, review'a ekler veya disa aktarir.

Bu yuzden urun yalnizca "ceviri popup'i" degil, ayni zamanda hafif bir dil ogrenme yardimcisidir.

## Paketler

### 1. Chrome / Chromium uzantisi

Ana calisan urun budur.

Klasor:

```text
browser-extension/
```

Bu paket:

- tum normal web sayfalarinda genel metin modunda calisir
- video sitelerinde altyaziya odakli davranis kullanir
- popup icinden ayarlanir
- review ve export ozelliklerini icerir

Detayli teknik ve kullanim notlari:

- [browser-extension/README.md](browser-extension/README.md)

### 2. iPhone / iPad Safari paketi

Klasor:

```text
safari-extension/
```

Bu paket, Chrome uzantisinin cekirdegini Safari Web Extension formatina tasir.

Detayli kurulum:

- [safari-extension/README.md](safari-extension/README.md)

### 3. macOS Safari paketi

Klasor:

```text
safari-extension-macos/
```

Bu paket, ayni davranisi macOS Safari tarafina tasir.

Detayli kurulum:

- [safari-extension-macos/README.md](safari-extension-macos/README.md)

## Ozellikler

### Kelime hover

- kelimenin ustune gelince tooltip acar
- secilemeyen subtitle overlay'lerde de calismasi icin DOM + rect + fallback mantigi kullanir
- video player kontrol barini gereksiz yere tetiklememeye calisir

### Selection cevirisi

- normal text selection varsa onu kullanir
- subtitle overlay secilemiyorsa custom drag selection fallback'i kullanir
- 2-3 kelime ve daha uzun secimlerde toplu ceviri verir

### Phrase / idiom tespiti

Tek kelimeye bakmakla yetinmez. Uygunsa:

- phrase
- phrasal verb
- idiom
- baglamsal ifade

olarak daha buyuk parcayi da yakalamaya calisir.

### Detayli tooltip

Tek kelimelik tooltip'te su bolumler bulunabilir:

- temel ceviri
- detayli anlam
- synonym listesi
- word formation
- source dictionary aciklamasi
- examples
- phrase / idiom sonucu

### Pin ve quick save

Tooltip acikken:

- `S`: kaydet
- `P`: sabitle
- `Esc`: kapat

Pin davranisi ozellikle video sitelerinde kartin hemen kaybolmamasini saglamak icin eklendi.

### Ogrenme akislar

Popup icinde:

- bilinmeyenler listesi
- mini review
- tekrar / zor / bildim akisi
- Anki TSV export
- CSV export

bulunur.

### Site profilleri

Video siteleri icin ayri davranis saklanabilir:

- hover gecikmesi
- tooltip yerlesimi
- tooltip boyutu

Bu sayede YouTube, Max ya da baska bir sitede farkli his verecek ayarlar tutulabilir.

## Desteklenen modlar

### Video modu

Oncelikli odak siteler:

- YouTube
- Netflix
- Prime Video
- Disney+
- Max
- Udemy
- Twitch

Bu sitelerde once bilinen subtitle selector'lari denenir. Eslesme yoksa video civarinda gorunur subtitle overlay fallback'i calisir.

### Web modu

Video olmayan sayfalarda:

- paragraf
- baslik
- liste
- kisa metin bloklari
- article / main icerigi

uzerinde genel hover cevirisi yapilir.

### Deep DOM modu

Uzanti yalnizca basit DOM'da calismaz. Ek olarak:

- `iframe`
- `srcdoc`
- acik `shadow DOM`

icinde de text bulmaya calisir.

## Mimari

Projede 3 ana JavaScript parcasi vardir.

### `content.js`

Sayfanin icinde calisir.

Sorumluluklari:

- hover ve selection dinleme
- altyazi / web metni tespiti
- tooltip cizimi
- pin davranisi
- player kontrol bariyla cakismayi azaltma
- scroll, drag ve interaction mantigi

### `background.js`

Arka plan islerini yonetir.

Sorumluluklari:

- ceviri istegi
- settings saklama
- bilinmeyenler listesi
- review state
- export verisi hazirlama
- site profili ayarlari

### `popup.*`

Kullanicinin gordugu uzanti arayuzudur.

Sorumluluklari:

- aktif sekme durumu
- dil ayarlari
- site profili ayarlari
- review paneli
- Anki / CSV export
- bilinmeyenler listesi

## Repo yapisi

```text
browser-extension/         Chrome ve Chromium uzantisi
safari-extension/          iPhone ve iPad Safari Xcode projesi
safari-extension-macos/    macOS Safari Xcode projesi
public/                    Yerel fixture ve test sayfalari
scripts/                   Paketleme, otomasyon ve smoke test script'leri
server.js                  Yerel test sunucusu
package.json               Yerel gelistirme komutlari
```

## Hizli baslangic

### Gereksinimler

Yerel gelistirme ve smoke test icin:

- Node.js 18+
- npm
- Chrome veya Chromium

### Chrome / Chromium

Bu paket icin build adimi yoktur. Kurulum dogrudan `Load unpacked` ile yapilir.

1. `chrome://extensions` ac
2. `Developer mode` ac
3. `Load unpacked` sec
4. `browser-extension/` klasorunu yukle

Sonra herhangi bir sayfada:

- kelimenin ustune gel
- ya da 2-3 kelime sec

### iPhone / iPad Safari

1. Xcode ile `safari-extension/Subtitle Hover Translator/Subtitle Hover Translator.xcodeproj` ac
2. `Signing & Capabilities` altinda kendi `Team` bilgisini sec
3. `Subtitle Hover Translator` target'ini cihaza veya simulator'e calistir
4. iPhone / iPad'de Safari uzantisini etkinlestir

### macOS Safari

1. Xcode ile `safari-extension-macos/Subtitle Hover Translator for Mac/Subtitle Hover Translator for Mac.xcodeproj` ac
2. `Signing & Capabilities` altinda kendi `Team` bilgisini sec
3. `Subtitle Hover Translator for Mac` target'ini calistir
4. Safari > Extensions icinde uzantiyi ac

## Yerel gelistirme ortami

Ilk kurulum:

```bash
npm install
```

Not:

- `npm install` yalnizca yerel test, smoke script ve paketleme icindir
- Chrome uzantisini normal kullanmak icin `browser-extension/` klasorunu dogrudan yuklemek yeterlidir

Sunucuyu ac:

```bash
npm start
```

Varsayilan test adresleri:

- `http://localhost:3000`
- `http://localhost:3000/mock-video-sites.html?shtSite=youtube`
- `http://localhost:3000/mock-video-sites.html?shtSite=max`
- `http://localhost:3000/mock-video-sites.html?shtSite=native`
- `http://localhost:3000/mock-generic-site.html`
- `http://localhost:3000/mock-everywhere.html`

## Test ve dogrulama

Repoda iki ana smoke test vardir.

### Stability smoke

```bash
npm run smoke:stability
```

Bu akista su senaryolar kontrol edilir:

- generic hover
- video subtitle hover
- pin davranisi
- player kontrol bariyla cakismama
- native text track fallback

### Path uyumlulugu

Proje, bosluk ve Turkce karakter iceren bir path altinda ayrica dogrulandi.

Ornek test path'i:

```text
/tmp/Türkçe Kurulum Doğrulama .../altyazı çeviri çalışma
```

Bu path altinda su zincir basariyla calistirildi:

- `npm install`
- `PORT=3017 npm start`
- `npm run smoke:stability`
- `./scripts/package_chrome_web_store.sh`

### Real site smoke

```bash
npm run smoke:real
```

Bu akista acik erisilebilir gercek sitelerde temel hover akisi kontrol edilir.

Not:

- bu test gercek login gerektiren playback ekranlarini garanti etmez
- daha cok acik web yuzeylerinde regresyon yakalamak icindir

## Otomasyon script'leri

### iOS Safari etkinlestirme

```bash
./scripts/run_ios_extension_automation.sh
```

Ne yapar:

- simulator boot eder
- app'i kurar
- Safari extension etkinlestirme akisina girer
- XCUITest ile ayar ekranlarini gezer

### macOS Safari etkinlestirme

```bash
./scripts/run_macos_extension_automation.sh
```

Ne yapar:

- macOS Safari projesini derler
- gerekirse local signing fallback uygular
- Safari extension ayarlarina yonlendirir
- GUI automation ile etkinlestirmeye yardim eder

### Chrome Web Store paketi

```bash
./scripts/package_chrome_web_store.sh
```

Bu script Chrome Web Store icin zip paketini hazirlar.

### Paylasim paketleri

```bash
./scripts/package_share_builds.sh
```

Bu script arkadaslarla paylasmak icin cikti paketleri uretir.

## Kullanim akisi

Gundelik kullanimda kullanicidan beklenen sey su:

1. Sayfayi ac
2. Kelimeye hover yap
3. Gerekiyorsa 2-3 kelime sec
4. Tooltip'ten anlami oku
5. `S` ile kaydet
6. Popup'tan review yap
7. Istiyorsa Anki ya da CSV olarak disa aktar

## Gizlilik ve veri saklama

Mevcut tasarim mantigi:

- kaydedilen bilinmeyenler local storage icinde tutulur
- popup review ve export bunun ustunden calisir
- ceviri icin ag uzerinden istek yapilir

Bu yuzden repo yayinlanacaksa:

- privacy policy
- store metadata
- veri isleme beyanlari

ayri ve net sekilde hazir tutulmalidir.

## Bilinen sinirlar

Proje guclu bir beta seviyesindedir; ancak su sinirlar halen gecerli:

- `chrome://` gibi korumali sayfalarda calismaz
- kapali `shadow DOM` icindeki metin her zaman yakalanmaz
- canvas / OCR gerektiren subtitle yuzeyleri her zaman DOM tabanli okunamaz
- login gerektiren gercek playback ekranlarinda siteye ozel tuning ihtiyaci olabilir
- Safari tarafi kurulum ve izin modeli nedeniyle Chrome kadar rahat degildir
- sistem geneli overlay degildir; tarayici uzantisi mantiginda calisir

## Ne degil

Bu proje:

- masaustu genel overlay degil
- VLC / mpv eklentisi degil
- iOS'ta tum uygulamalarin ustunde calisan sistem araci degil

Tarayici icindeki gorunur web metni ve subtitle overlay odagina sahip bir urundur.

## Su anki kalite seviyesi

Pratik degerlendirme:

- demo icin uygun
- paylasim icin uygun
- Chrome tarafinda beta yayin seviyesine yakin
- her sitede kusursuz, hic ayar istemeyen nihai urun seviyesinde degil

Bir sonraki buyuk kalite adimlari genelde sunlar olur:

- OCR fallback
- docked panel
- daha guclu review sistemi
- bulut senkron

## Hangi README'yi ne zaman okuyayim

- once bu dosya: urunun genel resmi
- sonra [browser-extension/README.md](browser-extension/README.md): Chrome uzantisi detayi
- iOS gerekiyorsa [safari-extension/README.md](safari-extension/README.md)
- macOS Safari gerekiyorsa [safari-extension-macos/README.md](safari-extension-macos/README.md)

## Son not

Bu repo tek seferlik bir deneme degil; hem urun hem de test altyapisi beraber tutuluyor. O yuzden yeni ozellik eklerken yalnizca `browser-extension/` degil, gerekiyorsa Safari kopyalari ve smoke test script'leri de birlikte guncellenmelidir.
