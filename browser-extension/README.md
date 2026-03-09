# Subtitle Hover Translator Browser Extension

Bu klasor repo icindeki ana Chrome/Chromium uzantisidir. Video sitelerindeki altyazi overlay'lerinde ve normal web sayfalarindaki gorunur metinde calisir.

## Ne yapar

- Kelimenin ustune gelince anlik ceviri kutusu acar
- 2-3 kelime veya daha uzun secimlerde toplu ceviri verir
- `Bilinmeyenlere ekle` ile kelime veya cumleyi kaydeder
- Popup icinden sadece aktif sekmede acilip kapanir
- Popup icinden kaynak ve hedef dil secilir
- Bilinen video sitelerinde player overlay altyazilarini ayri olarak hedefler

## Calisma modlari

- `Video modu`: YouTube, Netflix, Prime Video, Disney+, Max, Udemy, Twitch gibi sitelerde once bilinen subtitle selector'lari, sonra genel video overlay fallback'i kullanilir
- `Web modu`: Normal sitelerde paragraf, baslik, liste ve kisa metin bloklari ustunde hover ve secim cevirisi yapilir

## Odak video siteleri

- YouTube
- Netflix
- Prime Video
- Disney+
- Max
- Udemy
- Twitch

Bu sitelerde once bilinen subtitle selector'lari denenir. Eslesme yoksa gorunur video + altyazi benzeri DOM icin genel fallback devreye girer.

## Nasil calisir

Uzanti 3 ana parcadan olusur:

- `content.js`
Sayfa icine enjekte olur. Hover ve selection olaylarini dinler. Bilinen hostlarda subtitle selector'larini dener, bulamazsa video overlay fallback'ine gecer; video yoksa genel web metni ustunde calisir. Tooltip cizer.

- `background.js`
Ceviri isteklerini yapar. Ayarlari ve bilinmeyen kelimeleri `chrome.storage` icinde saklar.

- `popup.*`
Kullanicinin uzantiyi acip kapattigi, aktif host bilgisini gordugu ve kayitlara baktigi arayuz.

## Kurulum

1. Chrome veya Chromium ac
2. `chrome://extensions` adresine git
3. `Developer mode` ac
4. `Load unpacked` sec
5. Bu klasoru sec:

```text
browser-extension/
```

## Kullanim

1. Chrome veya Chromium'da herhangi bir web sayfasi ya da altyazili video sayfasi ac
2. Uzanti popup'ini ac
3. Sayfa moduna bak
4. `Bu sekmede etkin` anahtarini ac
5. Kelime ustune gel veya metni sec
6. Istersen `Bilinmeyenlere ekle`

## Depolanan veriler

Uzanti su verileri local storage icinde tutar:

- dil ayarlari
- hangi sekmede aktif oldugu
- kaydedilen bilinmeyen kelimeler/cumleler

Kayitlar su alanlari icerir:

- `sourceText`
- `translatedText`
- `sourceLang`
- `targetLang`
- `context`
- `hostname`
- `pageUrl`
- `savedAt`

## Bilinen sinirlar

- Sadece DOM olarak okunabilen altyazi ve metinlerde iyi calisir
- Canvas icine basilan veya videoya gomulu goruntu altyazilarini dogrudan okuyamaz
- Site DOM'u degisirse bilinen selector'lar bozulabilir
- Genel fallback modu bazen subtitle disi yakin metin bloklarini da yakalayabilir
- `chrome://`, Chrome Web Store ve bazi tarayici ic sayfalarinda content script calismaz
- iOS'ta bu paket dogrudan calismaz; bu Chrome uzantisidir
- iOS icin Safari Web Extension ayri paketlenmelidir

## Test durumu

Asagidaki akislar dogrulandi:

- Uzanti yukleniyor
- Popup aciliyor
- Sekme bazli enable/disable calisiyor
- Hover cevirisi geliyor
- Genel web metni hover cevirisi geliyor
- Bilinmeyenlere kaydetme storage'a yaziyor
- Popup sayfa modunu gosterebiliyor

## Yerel fixture

Gelisim sirasinda:

- `public/mock-video-sites.html?shtSite=youtube`
- `public/mock-video-sites.html?shtSite=max`
- `public/mock-generic-site.html`

adresleriyle video ve genel web metni senaryolarini test edebilirsin.
