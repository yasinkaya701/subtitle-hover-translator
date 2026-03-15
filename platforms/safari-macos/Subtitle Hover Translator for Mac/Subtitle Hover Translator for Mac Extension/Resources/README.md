# Subtitle Hover Translator Browser Extension

Bu klasor repo icindeki asil urundur. Chrome/Chromium icinde, video sitesinin ustunde gorunen altyazi metniyle etkilesime girer.

## Ne yapar

- Kelimenin ustune gelince anlik ceviri kutusu acar
- Altyazi satirindan metin secince toplu ceviri verir
- `Bilinmeyenlere ekle` ile kelime veya cumleyi kaydeder
- Popup icinden sadece aktif sekmede acilip kapanir
- Popup icinden kaynak ve hedef dil secilir

## Hedeflenen video siteleri

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
Sayfa icine enjekte olur. Hover ve selection olaylarini dinler. Desteklenen hostlar icin bilinen subtitle selector'larini dener, bulamazsa video civarindaki altyazi benzeri DOM'u hedefler. Tooltip cizer.

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

1. Altyazili bir video sayfasini ac
2. Uzanti popup'ini ac
3. Host durumuna bak
4. `Bu sekmede etkin` anahtarini ac
5. Kelime ustune gel veya altyazi metnini sec
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

- Sadece DOM olarak okunabilen altyazilarda iyi calisir
- Canvas icine basilan veya videoya gomulu goruntu altyazilarini dogrudan okuyamaz
- Site DOM'u degisirse bilinen selector'lar bozulabilir
- Fallback modu bazen subtitle disi alt kisim yazilarini da yakalayabilir
- iOS'ta bu paket dogrudan calismaz; bu Chrome uzantisidir
- iOS icin Safari Web Extension ayri paketlenmelidir

## Test durumu

Asagidaki akislar dogrulandi:

- Uzanti yukleniyor
- Popup aciliyor
- Sekme bazli enable/disable calisiyor
- Hover cevirisi geliyor
- Bilinmeyenlere kaydetme storage'a yaziyor
- Popup desteklenen video host bilgisini gosterebiliyor

## Yerel fixture

Gelisim sirasinda `public/mock-video-sites.html?shtSite=youtube` ile YouTube benzeri caption DOM'u test edebilirsin.
