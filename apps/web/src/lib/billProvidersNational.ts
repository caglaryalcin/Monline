// Provider names, official sites and province associations from e-Devlet public institution directories.
// Snapshot: 2026-10-26. Original sources and logos: assets/logos/merchants/SOURCES.md.
export interface NationalBillProvider { id: string; name: string; domain: string; group: "water" | "gas" | "electricity_retail"; regions: string[]; aliases: string[]; logoFile?: string; }
export const NATIONAL_BILL_PROVIDERS: NationalBillProvider[] = [
  {
    "id": "water-adiyaman-belediyesi",
    "name": "Adıyaman Belediyesi (Merkez Su)",
    "domain": "adiyaman.bel.tr",
    "group": "water",
    "regions": [
      "Adıyaman (İl merkezi)"
    ],
    "aliases": [
      "Adıyaman Belediyesi"
    ],
    "logoFile": "provider-water-adiyaman-belediyesi-official64.webp"
  },
  {
    "id": "askiadana",
    "name": "Adana Su ve Kanalizasyon İdaresi",
    "domain": "adana-aski.gov.tr",
    "group": "water",
    "regions": [
      "Adana"
    ],
    "aliases": [
      "Adana Su ve Kanalizasyon İdaresi Genel Müdürlüğü"
    ],
    "logoFile": "provider-askiadana-official64.webp"
  },
  {
    "id": "water-afyonkarahisar-belediyesi",
    "name": "Afyonkarahisar Belediyesi (Merkez Su)",
    "domain": "afyon.bel.tr",
    "group": "water",
    "regions": [
      "Afyonkarahisar (İl merkezi)"
    ],
    "aliases": [
      "Afyonkarahisar Belediyesi"
    ],
    "logoFile": "provider-water-afyonkarahisar-belediyesi-official64.webp"
  },
  {
    "id": "water-agri-belediyesi",
    "name": "Ağrı Belediyesi (Merkez Su)",
    "domain": "agri.bel.tr",
    "group": "water",
    "regions": [
      "Ağrı (İl merkezi)"
    ],
    "aliases": [
      "Ağrı Belediyesi"
    ],
    "logoFile": "provider-water-agri-belediyesi-official64.webp"
  },
  {
    "id": "water-aksaray-belediyesi",
    "name": "Aksaray Belediyesi (Merkez Su)",
    "domain": "aksaray.bel.tr",
    "group": "water",
    "regions": [
      "Aksaray (İl merkezi)"
    ],
    "aliases": [
      "Aksaray Belediyesi"
    ],
    "logoFile": "provider-water-aksaray-belediyesi-official64.webp"
  },
  {
    "id": "water-amasya-belediyesi",
    "name": "Amasya Belediyesi (Merkez Su)",
    "domain": "amasya.bel.tr",
    "group": "water",
    "regions": [
      "Amasya (İl merkezi)"
    ],
    "aliases": [
      "Amasya Belediyesi"
    ],
    "logoFile": "provider-water-amasya-belediyesi-official64.webp"
  },
  {
    "id": "askiankara",
    "name": "Ankara Su ve Kanalizasyon İdaresi",
    "domain": "aski.gov.tr",
    "group": "water",
    "regions": [
      "Ankara"
    ],
    "aliases": [
      "Ankara Su ve Kanalizasyon İdaresi Genel Müdürlüğü"
    ],
    "logoFile": "provider-askiankara-official64.webp"
  },
  {
    "id": "asat",
    "name": "Antalya Su ve Atıksu İdaresi",
    "domain": "asat.gov.tr",
    "group": "water",
    "regions": [
      "Antalya"
    ],
    "aliases": [
      "Antalya Su ve Atıksu İdaresi Genel Müdürlüğü"
    ],
    "logoFile": "provider-asat-official64.webp"
  },
  {
    "id": "water-ardahan-belediyesi",
    "name": "Ardahan Belediyesi (Merkez Su)",
    "domain": "ardahan.bel.tr",
    "group": "water",
    "regions": [
      "Ardahan (İl merkezi)"
    ],
    "aliases": [
      "Ardahan Belediyesi"
    ],
    "logoFile": "provider-water-ardahan-belediyesi-official64.webp"
  },
  {
    "id": "water-artvin-belediyesi",
    "name": "Artvin Belediyesi (Merkez Su)",
    "domain": "artvin.bel.tr",
    "group": "water",
    "regions": [
      "Artvin (İl merkezi)"
    ],
    "aliases": [
      "Artvin Belediyesi"
    ],
    "logoFile": "provider-water-artvin-belediyesi-official64.webp"
  },
  {
    "id": "water-aydin-su-ve-kanalizasyon-idaresi-genel-mudurlugu",
    "name": "Aydın Su ve Kanalizasyon İdaresi",
    "domain": "aydinaski.gov.tr",
    "group": "water",
    "regions": [
      "Aydın"
    ],
    "aliases": [
      "Aydın Su ve Kanalizasyon İdaresi Genel Müdürlüğü"
    ],
    "logoFile": "provider-water-aydin-su-ve-kanalizasyon-idaresi-genel-mudurlugu-official64.webp"
  },
  {
    "id": "water-balikesir-su-ve-kanalizasyon-idaresi",
    "name": "Balıkesir Su ve Kanalizasyon İdaresi",
    "domain": "balsu.gov.tr",
    "group": "water",
    "regions": [
      "Balıkesir"
    ],
    "aliases": [
      "Balıkesir Su ve Kanalizasyon İdaresi"
    ],
    "logoFile": "provider-water-balikesir-su-ve-kanalizasyon-idaresi-official64.webp"
  },
  {
    "id": "water-bartin-belediyesi",
    "name": "Bartın Belediyesi (Merkez Su)",
    "domain": "bartin.bel.tr",
    "group": "water",
    "regions": [
      "Bartın (İl merkezi)"
    ],
    "aliases": [
      "Bartın Belediyesi"
    ],
    "logoFile": "provider-water-bartin-belediyesi-official64.webp"
  },
  {
    "id": "water-batman-belediyesi",
    "name": "Batman Belediyesi (Merkez Su)",
    "domain": "batman.bel.tr",
    "group": "water",
    "regions": [
      "Batman (İl merkezi)"
    ],
    "aliases": [
      "Batman Belediyesi"
    ],
    "logoFile": "provider-water-batman-belediyesi-official64.webp"
  },
  {
    "id": "water-bayburt-belediyesi",
    "name": "Bayburt Belediyesi (Merkez Su)",
    "domain": "bayburt.bel.tr",
    "group": "water",
    "regions": [
      "Bayburt (İl merkezi)"
    ],
    "aliases": [
      "Bayburt Belediyesi"
    ],
    "logoFile": "provider-water-bayburt-belediyesi-official64.webp"
  },
  {
    "id": "water-bilecik-belediyesi",
    "name": "Bilecik Belediyesi (Merkez Su)",
    "domain": "bilecik.bel.tr",
    "group": "water",
    "regions": [
      "Bilecik (İl merkezi)"
    ],
    "aliases": [
      "Bilecik Belediyesi"
    ],
    "logoFile": "provider-water-bilecik-belediyesi-official64.webp"
  },
  {
    "id": "water-bingol-belediyesi",
    "name": "Bingöl Belediyesi (Merkez Su)",
    "domain": "bingol.bel.tr",
    "group": "water",
    "regions": [
      "Bingöl (İl merkezi)"
    ],
    "aliases": [
      "Bingöl Belediyesi"
    ],
    "logoFile": "provider-water-bingol-belediyesi-official64.webp"
  },
  {
    "id": "water-bolu-belediyesi",
    "name": "Bolu Belediyesi (Merkez Su)",
    "domain": "bolu.bel.tr",
    "group": "water",
    "regions": [
      "Bolu (İl merkezi)"
    ],
    "aliases": [
      "Bolu Belediyesi"
    ],
    "logoFile": "provider-water-bolu-belediyesi-official64.webp"
  },
  {
    "id": "water-bitlis-belediyesi",
    "name": "Bitlis Belediyesi (Merkez Su)",
    "domain": "bitlis.bel.tr",
    "group": "water",
    "regions": [
      "Bitlis (İl merkezi)"
    ],
    "aliases": [
      "Bitlis Belediyesi"
    ],
    "logoFile": "provider-water-bitlis-belediyesi-official64.webp"
  },
  {
    "id": "water-burdur-belediyesi",
    "name": "Burdur Belediyesi (Merkez Su)",
    "domain": "burdur.bel.tr",
    "group": "water",
    "regions": [
      "Burdur (İl merkezi)"
    ],
    "aliases": [
      "Burdur Belediyesi"
    ],
    "logoFile": "provider-water-burdur-belediyesi-official64.webp"
  },
  {
    "id": "buski",
    "name": "Bursa Su ve Kanalizasyon İdaresi",
    "domain": "buski.gov.tr",
    "group": "water",
    "regions": [
      "Bursa"
    ],
    "aliases": [
      "Bursa Su ve Kanalizasyon İdaresi Genel Müdürlüğü"
    ],
    "logoFile": "provider-buski-official64.webp"
  },
  {
    "id": "water-canakkale-belediyesi",
    "name": "Çanakkale Belediyesi (Merkez Su)",
    "domain": "canakkale.bel.tr",
    "group": "water",
    "regions": [
      "Çanakkale (İl merkezi)"
    ],
    "aliases": [
      "Çanakkale Belediyesi"
    ],
    "logoFile": "provider-water-canakkale-belediyesi-official64.webp"
  },
  {
    "id": "water-cankiri-belediyesi",
    "name": "Çankırı Belediyesi (Merkez Su)",
    "domain": "cankiri.bel.tr",
    "group": "water",
    "regions": [
      "Çankırı (İl merkezi)"
    ],
    "aliases": [
      "Çankırı Belediyesi"
    ],
    "logoFile": "provider-water-cankiri-belediyesi-official64.webp"
  },
  {
    "id": "water-denizli-su-ve-kanalizasyon-idaresi-genel-mudurlugu",
    "name": "Denizli Su ve Kanalizasyon İdaresi",
    "domain": "deski.gov.tr",
    "group": "water",
    "regions": [
      "Denizli"
    ],
    "aliases": [
      "Denizli Su ve Kanalizasyon İdaresi Genel Müdürlüğü"
    ],
    "logoFile": "provider-water-denizli-su-ve-kanalizasyon-idaresi-genel-mudurlugu-official64.webp"
  },
  {
    "id": "water-diyarbakir-su-ve-kanalizasyon-idaresi-genel-mudurlugu",
    "name": "Diyarbakır Su ve Kanalizasyon İdaresi",
    "domain": "diski.gov.tr",
    "group": "water",
    "regions": [
      "Diyarbakır"
    ],
    "aliases": [
      "Diyarbakır Su ve Kanalizasyon İdaresi Genel Müdürlüğü"
    ],
    "logoFile": "provider-water-diyarbakir-su-ve-kanalizasyon-idaresi-genel-mudurlugu-official64.webp"
  },
  {
    "id": "water-corum-belediyesi",
    "name": "Çorum Belediyesi (Merkez Su)",
    "domain": "corum.bel.tr",
    "group": "water",
    "regions": [
      "Çorum (İl merkezi)"
    ],
    "aliases": [
      "Çorum Belediyesi"
    ],
    "logoFile": "provider-water-corum-belediyesi-official64.webp"
  },
  {
    "id": "water-duzce-belediyesi",
    "name": "Düzce Belediyesi (Merkez Su)",
    "domain": "duzce.bel.tr",
    "group": "water",
    "regions": [
      "Düzce (İl merkezi)"
    ],
    "aliases": [
      "Düzce Belediyesi"
    ],
    "logoFile": "provider-water-duzce-belediyesi-official64.webp"
  },
  {
    "id": "edirnesu",
    "name": "Edirne Belediyesi (Merkez Su)",
    "domain": "edirne.bel.tr",
    "group": "water",
    "regions": [
      "Edirne (İl merkezi)"
    ],
    "aliases": [
      "Edirne Belediyesi"
    ],
    "logoFile": "provider-edirnesu-official64.webp"
  },
  {
    "id": "water-elazig-belediyesi",
    "name": "Elazığ Belediyesi (Merkez Su)",
    "domain": "elazig.bel.tr",
    "group": "water",
    "regions": [
      "Elazığ (İl merkezi)"
    ],
    "aliases": [
      "Elazığ Belediyesi"
    ],
    "logoFile": "provider-water-elazig-belediyesi-official64.webp"
  },
  {
    "id": "water-erzincan-belediyesi",
    "name": "Erzincan Belediyesi (Merkez Su)",
    "domain": "erzincan.bel.tr",
    "group": "water",
    "regions": [
      "Erzincan (İl merkezi)"
    ],
    "aliases": [
      "Erzincan Belediyesi"
    ],
    "logoFile": "provider-water-erzincan-belediyesi-official64.webp"
  },
  {
    "id": "water-erzurum-su-ve-kanalizasyon-idaresi-genel-mudurlugu",
    "name": "Erzurum Su ve Kanalizasyon İdaresi",
    "domain": "eski.gov.tr",
    "group": "water",
    "regions": [
      "Erzurum"
    ],
    "aliases": [
      "Erzurum Su ve Kanalizasyon İdaresi Genel Müdürlüğü"
    ],
    "logoFile": "provider-water-erzurum-su-ve-kanalizasyon-idaresi-genel-mudurlugu-official64.webp"
  },
  {
    "id": "water-eskisehir-su-ve-kanalizasyon-idaresi-genel-mudurlugu",
    "name": "Eskişehir Su ve Kanalizasyon İdaresi",
    "domain": "eskisehir-eski.gov.tr",
    "group": "water",
    "regions": [
      "Eskişehir"
    ],
    "aliases": [
      "Eskişehir Su ve Kanalizasyon İdaresi Genel Müdürlüğü"
    ],
    "logoFile": "provider-water-eskisehir-su-ve-kanalizasyon-idaresi-genel-mudurlugu-official64.webp"
  },
  {
    "id": "water-gaziantep-su-ve-kanalizasyon-idaresi-genel-mudurlugu",
    "name": "Gaziantep Su ve Kanalizasyon İdaresi",
    "domain": "gaski.gov.tr",
    "group": "water",
    "regions": [
      "Gaziantep"
    ],
    "aliases": [
      "Gaziantep Su ve Kanalizasyon İdaresi Genel Müdürlüğü"
    ],
    "logoFile": "provider-water-gaziantep-su-ve-kanalizasyon-idaresi-genel-mudurlugu-official64.webp"
  },
  {
    "id": "water-giresun-belediyesi",
    "name": "Giresun Belediyesi (Merkez Su)",
    "domain": "giresun.bel.tr",
    "group": "water",
    "regions": [
      "Giresun (İl merkezi)"
    ],
    "aliases": [
      "Giresun Belediyesi"
    ],
    "logoFile": "provider-water-giresun-belediyesi-official64.webp"
  },
  {
    "id": "water-gumushane-belediyesi",
    "name": "Gümüşhane Belediyesi (Merkez Su)",
    "domain": "gumushane.bel.tr",
    "group": "water",
    "regions": [
      "Gümüşhane (İl merkezi)"
    ],
    "aliases": [
      "Gümüşhane Belediyesi"
    ],
    "logoFile": "provider-water-gumushane-belediyesi-official64.webp"
  },
  {
    "id": "water-hakkari-belediyesi",
    "name": "Hakkari Belediyesi (Merkez Su)",
    "domain": "hakkari.bel.tr",
    "group": "water",
    "regions": [
      "Hakkari (İl merkezi)"
    ],
    "aliases": [
      "Hakkari Belediyesi"
    ],
    "logoFile": "provider-water-hakkari-belediyesi-official64.webp"
  },
  {
    "id": "water-igdir-belediyesi",
    "name": "Iğdır Belediyesi (Merkez Su)",
    "domain": "igdir.bel.tr",
    "group": "water",
    "regions": [
      "Iğdır (İl merkezi)"
    ],
    "aliases": [
      "Iğdır Belediyesi"
    ],
    "logoFile": "provider-water-igdir-belediyesi-official64.webp"
  },
  {
    "id": "water-hatay-su-ve-kanalizasyon-idaresi-genel-mudurlugu",
    "name": "Hatay Su ve Kanalizasyon İdaresi",
    "domain": "hatsu.gov.tr",
    "group": "water",
    "regions": [
      "Hatay"
    ],
    "aliases": [
      "Hatay Su ve Kanalizasyon İdaresi Genel Müdürlüğü"
    ],
    "logoFile": "provider-water-hatay-su-ve-kanalizasyon-idaresi-genel-mudurlugu-official64.webp"
  },
  {
    "id": "water-isparta-belediyesi",
    "name": "Isparta Belediyesi (Merkez Su)",
    "domain": "isparta.bel.tr",
    "group": "water",
    "regions": [
      "Isparta (İl merkezi)"
    ],
    "aliases": [
      "Isparta Belediyesi"
    ],
    "logoFile": "provider-water-isparta-belediyesi-official64.webp"
  },
  {
    "id": "iski",
    "name": "İstanbul Su ve Kanalizasyon İdaresi",
    "domain": "iski.istanbul",
    "group": "water",
    "regions": [
      "İstanbul"
    ],
    "aliases": [
      "İstanbul Su ve Kanalizasyon İdaresi Genel Müdürlüğü"
    ],
    "logoFile": "provider-iski-official64.webp"
  },
  {
    "id": "izsu",
    "name": "İzmir Su ve Kanalizasyon İdaresi",
    "domain": "izsu.gov.tr",
    "group": "water",
    "regions": [
      "İzmir"
    ],
    "aliases": [
      "İzmir Su ve Kanalizasyon İdaresi Genel Müdürlüğü"
    ],
    "logoFile": "provider-izsu-official64.webp"
  },
  {
    "id": "water-kahramanmaras-su-ve-kanalizasyon-idaresi-genel-mudurlugu",
    "name": "Kahramanmaraş Su ve Kanalizasyon İdaresi",
    "domain": "maraskaski.gov.tr",
    "group": "water",
    "regions": [
      "Kahramanmaraş"
    ],
    "aliases": [
      "Kahramanmaraş Su ve Kanalizasyon İdaresi Genel Müdürlüğü"
    ],
    "logoFile": "provider-water-kahramanmaras-su-ve-kanalizasyon-idaresi-genel-mudurlugu-official64.webp"
  },
  {
    "id": "water-karabuk-belediyesi",
    "name": "Karabük Belediyesi (Merkez Su)",
    "domain": "karabuk.bel.tr",
    "group": "water",
    "regions": [
      "Karabük (İl merkezi)"
    ],
    "aliases": [
      "Karabük Belediyesi"
    ],
    "logoFile": "provider-water-karabuk-belediyesi-official64.webp"
  },
  {
    "id": "water-karaman-belediyesi",
    "name": "Karaman Belediyesi (Merkez Su)",
    "domain": "karaman.bel.tr",
    "group": "water",
    "regions": [
      "Karaman (İl merkezi)"
    ],
    "aliases": [
      "Karaman Belediyesi"
    ],
    "logoFile": "provider-water-karaman-belediyesi-official64.webp"
  },
  {
    "id": "water-kars-belediyesi",
    "name": "Kars Belediyesi (Merkez Su)",
    "domain": "kars.bel.tr",
    "group": "water",
    "regions": [
      "Kars (İl merkezi)"
    ],
    "aliases": [
      "Kars Belediyesi"
    ],
    "logoFile": "provider-water-kars-belediyesi-official64.webp"
  },
  {
    "id": "water-kastamonu-belediyesi",
    "name": "Kastamonu Belediyesi (Merkez Su)",
    "domain": "kastamonu.bel.tr",
    "group": "water",
    "regions": [
      "Kastamonu (İl merkezi)"
    ],
    "aliases": [
      "Kastamonu Belediyesi"
    ],
    "logoFile": "provider-water-kastamonu-belediyesi-official64.webp"
  },
  {
    "id": "water-kayseri-su-ve-kanalizasyon-idaresi-genel-mudurlugu",
    "name": "Kayseri Su ve Kanalizasyon İdaresi",
    "domain": "kaski.gov.tr",
    "group": "water",
    "regions": [
      "Kayseri"
    ],
    "aliases": [
      "Kayseri Su ve Kanalizasyon İdaresi Genel Müdürlüğü"
    ],
    "logoFile": "provider-water-kayseri-su-ve-kanalizasyon-idaresi-genel-mudurlugu-official64.webp"
  },
  {
    "id": "water-kirikkale-belediyesi",
    "name": "Kırıkkale Belediyesi (Merkez Su)",
    "domain": "kirikkale-bld.gov.tr",
    "group": "water",
    "regions": [
      "Kırıkkale (İl merkezi)"
    ],
    "aliases": [
      "Kırıkkale Belediyesi"
    ],
    "logoFile": "provider-water-kirikkale-belediyesi-official64.webp"
  },
  {
    "id": "water-kirklareli-belediyesi",
    "name": "Kırklareli Belediyesi (Merkez Su)",
    "domain": "kirklareli.bel.tr",
    "group": "water",
    "regions": [
      "Kırklareli (İl merkezi)"
    ],
    "aliases": [
      "Kırklareli Belediyesi"
    ],
    "logoFile": "provider-water-kirklareli-belediyesi-official64.webp"
  },
  {
    "id": "water-kirsehir-belediyesi",
    "name": "Kırşehir Belediyesi (Merkez Su)",
    "domain": "kirsehir.bel.tr",
    "group": "water",
    "regions": [
      "Kırşehir (İl merkezi)"
    ],
    "aliases": [
      "Kırşehir Belediyesi"
    ],
    "logoFile": "provider-water-kirsehir-belediyesi-official64.webp"
  },
  {
    "id": "water-kilis-belediyesi",
    "name": "Kilis Belediyesi (Merkez Su)",
    "domain": "kilis.bel.tr",
    "group": "water",
    "regions": [
      "Kilis (İl merkezi)"
    ],
    "aliases": [
      "Kilis Belediyesi"
    ],
    "logoFile": "provider-water-kilis-belediyesi-official64.webp"
  },
  {
    "id": "water-kocaeli-su-ve-kanalizasyon-idaresi-genel-mudurlugu",
    "name": "Kocaeli Su ve Kanalizasyon İdaresi",
    "domain": "isu.gov.tr",
    "group": "water",
    "regions": [
      "Kocaeli"
    ],
    "aliases": [
      "Kocaeli Su ve Kanalizasyon İdaresi Genel Müdürlüğü"
    ],
    "logoFile": "provider-water-kocaeli-su-ve-kanalizasyon-idaresi-genel-mudurlugu-official64.webp"
  },
  {
    "id": "koski",
    "name": "Konya Su ve Kanalizasyon İdaresi",
    "domain": "koski.gov.tr",
    "group": "water",
    "regions": [
      "Konya"
    ],
    "aliases": [
      "Konya Su ve Kanalizasyon İdaresi Genel Müdürlüğü"
    ],
    "logoFile": "provider-koski-official64.webp"
  },
  {
    "id": "water-kutahya-belediyesi",
    "name": "Kütahya Belediyesi (Merkez Su)",
    "domain": "kutahya.bel.tr",
    "group": "water",
    "regions": [
      "Kütahya (İl merkezi)"
    ],
    "aliases": [
      "Kütahya Belediyesi"
    ],
    "logoFile": "provider-water-kutahya-belediyesi-official64.webp"
  },
  {
    "id": "water-malatya-su-ve-kanalizasyon-idaresi-genel-mudurlugu",
    "name": "Malatya Su ve Kanalizasyon İdaresi",
    "domain": "maski.gov.tr",
    "group": "water",
    "regions": [
      "Malatya"
    ],
    "aliases": [
      "Malatya Su ve Kanalizasyon İdaresi Genel Müdürlüğü"
    ],
    "logoFile": "provider-water-malatya-su-ve-kanalizasyon-idaresi-genel-mudurlugu-official64.webp"
  },
  {
    "id": "water-manisa-su-ve-kanalizasyon-idaresi-genel-mudurlugu",
    "name": "Manisa Su ve Kanalizasyon İdaresi",
    "domain": "manisasu.gov.tr",
    "group": "water",
    "regions": [
      "Manisa"
    ],
    "aliases": [
      "Manisa Su ve Kanalizasyon İdaresi Genel Müdürlüğü"
    ],
    "logoFile": "provider-water-manisa-su-ve-kanalizasyon-idaresi-genel-mudurlugu-official64.webp"
  },
  {
    "id": "water-mardin-su-ve-kanalizasyon-idaresi-genel-mudurlugu",
    "name": "Mardin Su ve Kanalizasyon İdaresi",
    "domain": "marsu.gov.tr",
    "group": "water",
    "regions": [
      "Mardin"
    ],
    "aliases": [
      "Mardin Su ve Kanalizasyon İdaresi Genel Müdürlüğü"
    ],
    "logoFile": "provider-water-mardin-su-ve-kanalizasyon-idaresi-genel-mudurlugu-official64.webp"
  },
  {
    "id": "water-mersin-su-ve-kanalizasyon-idaresi-genel-mudurlugu",
    "name": "Mersin Su ve Kanalizasyon İdaresi",
    "domain": "meski.gov.tr",
    "group": "water",
    "regions": [
      "Mersin"
    ],
    "aliases": [
      "Mersin Su ve Kanalizasyon İdaresi Genel Müdürlüğü"
    ],
    "logoFile": "provider-water-mersin-su-ve-kanalizasyon-idaresi-genel-mudurlugu-official64.webp"
  },
  {
    "id": "water-mugla-su-ve-kanalizasyon-idaresi-genel-mudurlugu",
    "name": "Muğla Su ve Kanalizasyon İdaresi",
    "domain": "muski.gov.tr",
    "group": "water",
    "regions": [
      "Muğla"
    ],
    "aliases": [
      "Muğla Su ve Kanalizasyon İdaresi Genel Müdürlüğü"
    ],
    "logoFile": "provider-water-mugla-su-ve-kanalizasyon-idaresi-genel-mudurlugu-official64.webp"
  },
  {
    "id": "water-mus-belediyesi",
    "name": "Muş Belediyesi (Merkez Su)",
    "domain": "mus.bel.tr",
    "group": "water",
    "regions": [
      "Muş (İl merkezi)"
    ],
    "aliases": [
      "Muş Belediyesi"
    ],
    "logoFile": "provider-water-mus-belediyesi-official64.webp"
  },
  {
    "id": "water-nevsehir-belediyesi",
    "name": "Nevşehir Belediyesi (Merkez Su)",
    "domain": "nevsehir.bel.tr",
    "group": "water",
    "regions": [
      "Nevşehir (İl merkezi)"
    ],
    "aliases": [
      "Nevşehir Belediyesi"
    ],
    "logoFile": "provider-water-nevsehir-belediyesi-official64.webp"
  },
  {
    "id": "water-nigde-belediyesi",
    "name": "Niğde Belediyesi (Merkez Su)",
    "domain": "nigde.bel.tr",
    "group": "water",
    "regions": [
      "Niğde (İl merkezi)"
    ],
    "aliases": [
      "Niğde Belediyesi"
    ],
    "logoFile": "provider-water-nigde-belediyesi-official64.webp"
  },
  {
    "id": "water-ordu-su-ve-kanalizasyon-idaresi-genel-mudurlugu",
    "name": "Ordu Su ve Kanalizasyon İdaresi",
    "domain": "oski.gov.tr",
    "group": "water",
    "regions": [
      "Ordu"
    ],
    "aliases": [
      "Ordu Su ve Kanalizasyon İdaresi Genel Müdürlüğü"
    ],
    "logoFile": "provider-water-ordu-su-ve-kanalizasyon-idaresi-genel-mudurlugu-official64.webp"
  },
  {
    "id": "water-rize-belediyesi",
    "name": "Rize Belediyesi (Merkez Su)",
    "domain": "rize.bel.tr",
    "group": "water",
    "regions": [
      "Rize (İl merkezi)"
    ],
    "aliases": [
      "Rize Belediyesi"
    ],
    "logoFile": "provider-water-rize-belediyesi-official64.webp"
  },
  {
    "id": "water-osmaniye-belediyesi",
    "name": "Osmaniye Belediyesi (Merkez Su)",
    "domain": "osmaniye-bld.gov.tr",
    "group": "water",
    "regions": [
      "Osmaniye (İl merkezi)"
    ],
    "aliases": [
      "Osmaniye Belediyesi"
    ],
    "logoFile": "provider-water-osmaniye-belediyesi-official64.webp"
  },
  {
    "id": "water-sakarya-su-ve-kanalizasyon-idaresi-genel-mudurlugu",
    "name": "Sakarya Su ve Kanalizasyon İdaresi",
    "domain": "sakarya-saski.gov.tr",
    "group": "water",
    "regions": [
      "Sakarya"
    ],
    "aliases": [
      "Sakarya Su ve Kanalizasyon İdaresi Genel Müdürlüğü"
    ],
    "logoFile": "provider-water-sakarya-su-ve-kanalizasyon-idaresi-genel-mudurlugu-official64.webp"
  },
  {
    "id": "water-samsun-su-ve-kanalizasyon-idaresi-genel-mudurlugu",
    "name": "Samsun Su ve Kanalizasyon İdaresi",
    "domain": "saski.gov.tr",
    "group": "water",
    "regions": [
      "Samsun"
    ],
    "aliases": [
      "Samsun Su ve Kanalizasyon İdaresi Genel Müdürlüğü"
    ],
    "logoFile": "provider-water-samsun-su-ve-kanalizasyon-idaresi-genel-mudurlugu-official64.webp"
  },
  {
    "id": "water-siirt-belediyesi",
    "name": "Siirt Belediyesi (Merkez Su)",
    "domain": "siirt.bel.tr",
    "group": "water",
    "regions": [
      "Siirt (İl merkezi)"
    ],
    "aliases": [
      "Siirt Belediyesi"
    ],
    "logoFile": "provider-water-siirt-belediyesi-official64.webp"
  },
  {
    "id": "water-sinop-belediyesi",
    "name": "Sinop Belediyesi (Merkez Su)",
    "domain": "sinop.bel.tr",
    "group": "water",
    "regions": [
      "Sinop (İl merkezi)"
    ],
    "aliases": [
      "Sinop Belediyesi"
    ],
    "logoFile": "provider-water-sinop-belediyesi-official64.webp"
  },
  {
    "id": "water-sanliurfa-su-ve-kanalizasyon-idaresi-genel-mudurlugu",
    "name": "Şanlıurfa Su ve Kanalizasyon İdaresi",
    "domain": "suski.gov.tr",
    "group": "water",
    "regions": [
      "Şanlıurfa"
    ],
    "aliases": [
      "Şanlıurfa Su ve Kanalizasyon İdaresi Genel Müdürlüğü"
    ],
    "logoFile": "provider-water-sanliurfa-su-ve-kanalizasyon-idaresi-genel-mudurlugu-official64.webp"
  },
  {
    "id": "water-sirnak-belediyesi",
    "name": "Şırnak Belediyesi (Merkez Su)",
    "domain": "sirnak.bel.tr",
    "group": "water",
    "regions": [
      "Şırnak (İl merkezi)"
    ],
    "aliases": [
      "Şırnak Belediyesi"
    ],
    "logoFile": "provider-water-sirnak-belediyesi-official64.webp"
  },
  {
    "id": "water-tekirdag-su-ve-kanalizasyon-idaresi-genel-mudurlugu",
    "name": "Tekirdağ Su ve Kanalizasyon İdaresi",
    "domain": "teski.gov.tr",
    "group": "water",
    "regions": [
      "Tekirdağ"
    ],
    "aliases": [
      "Tekirdağ Su ve Kanalizasyon İdaresi Genel Müdürlüğü"
    ],
    "logoFile": "provider-water-tekirdag-su-ve-kanalizasyon-idaresi-genel-mudurlugu-official64.webp"
  },
  {
    "id": "water-sivas-belediyesi",
    "name": "Sivas Belediyesi (Merkez Su)",
    "domain": "sivas.bel.tr",
    "group": "water",
    "regions": [
      "Sivas (İl merkezi)"
    ],
    "aliases": [
      "Sivas Belediyesi"
    ],
    "logoFile": "provider-water-sivas-belediyesi-official64.webp"
  },
  {
    "id": "water-tokat-belediyesi",
    "name": "Tokat Belediyesi (Merkez Su)",
    "domain": "tokat.bel.tr",
    "group": "water",
    "regions": [
      "Tokat (İl merkezi)"
    ],
    "aliases": [
      "Tokat Belediyesi"
    ],
    "logoFile": "provider-water-tokat-belediyesi-official64.webp"
  },
  {
    "id": "water-tunceli-belediyesi",
    "name": "Tunceli Belediyesi (Merkez Su)",
    "domain": "tunceli.bel.tr",
    "group": "water",
    "regions": [
      "Tunceli (İl merkezi)"
    ],
    "aliases": [
      "Tunceli Belediyesi"
    ],
    "logoFile": "provider-water-tunceli-belediyesi-official64.webp"
  },
  {
    "id": "water-usak-belediyesi",
    "name": "Uşak Belediyesi (Merkez Su)",
    "domain": "usak.bel.tr",
    "group": "water",
    "regions": [
      "Uşak (İl merkezi)"
    ],
    "aliases": [
      "Uşak Belediyesi"
    ],
    "logoFile": "provider-water-usak-belediyesi-official64.webp"
  },
  {
    "id": "water-trabzon-icmesuyu-ve-kanalizasyon-idaresi-genel-mudurlugu",
    "name": "Trabzon İçmesuyu ve Kanalizasyon İdaresi",
    "domain": "tiski.gov.tr",
    "group": "water",
    "regions": [
      "Trabzon"
    ],
    "aliases": [
      "Trabzon İçmesuyu ve Kanalizasyon İdaresi Genel Müdürlüğü"
    ],
    "logoFile": "provider-water-trabzon-icmesuyu-ve-kanalizasyon-idaresi-genel-mudurlugu-official64.webp"
  },
  {
    "id": "water-van-su-ve-kanalizasyon-idaresi-genel-mudurlugu",
    "name": "Van Su ve Kanalizasyon İdaresi",
    "domain": "vaski.gov.tr",
    "group": "water",
    "regions": [
      "Van"
    ],
    "aliases": [
      "Van Su ve Kanalizasyon İdaresi Genel Müdürlüğü"
    ],
    "logoFile": "provider-water-van-su-ve-kanalizasyon-idaresi-genel-mudurlugu-official64.webp"
  },
  {
    "id": "water-yalova-belediyesi",
    "name": "Yalova Belediyesi (Merkez Su)",
    "domain": "yalova.bel.tr",
    "group": "water",
    "regions": [
      "Yalova (İl merkezi)"
    ],
    "aliases": [
      "Yalova Belediyesi"
    ],
    "logoFile": "provider-water-yalova-belediyesi-official64.webp"
  },
  {
    "id": "water-yozgat-belediyesi",
    "name": "Yozgat Belediyesi (Merkez Su)",
    "domain": "yozgat.bel.tr",
    "group": "water",
    "regions": [
      "Yozgat (İl merkezi)"
    ],
    "aliases": [
      "Yozgat Belediyesi"
    ],
    "logoFile": "provider-water-yozgat-belediyesi-official64.webp"
  },
  {
    "id": "water-zonguldak-belediyesi",
    "name": "Zonguldak Belediyesi (Merkez Su)",
    "domain": "zonguldak.bel.tr",
    "group": "water",
    "regions": [
      "Zonguldak (İl merkezi)"
    ],
    "aliases": [
      "Zonguldak Belediyesi"
    ],
    "logoFile": "provider-water-zonguldak-belediyesi-official64.webp"
  },
  {
    "id": "gas-aksa-cukurova-dogal-gaz-dagitim-as",
    "name": "Aksa Çukurova Doğal Gaz Dağıtım",
    "domain": "aksadogalgaz.com.tr",
    "group": "gas",
    "regions": [
      "Adana",
      "Hatay",
      "Mersin",
      "Osmaniye"
    ],
    "aliases": [
      "Aksa Çukurova Doğal Gaz Dağıtım A.Ş.",
      "Aksa Çukurova Doğal Gaz Dağıtım",
      "Aksa Çukurova"
    ],
    "logoFile": "provider-gas-aksa-cukurova-dogal-gaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-akmercan-adiyaman-dogal-gaz-dagitim-sanayi-ve-ticaret-as",
    "name": "Akmercan Adıyaman Doğal Gaz Dağıtım Sanayi Ve Ticaret",
    "domain": "akmercangaz.com.tr",
    "group": "gas",
    "regions": [
      "Adıyaman"
    ],
    "aliases": [
      "Akmercan Adıyaman Doğal Gaz Dağıtım Sanayi Ve Ticaret A.Ş.",
      "Akmercan Adıyaman Doğal Gaz Dağıtım Sanayi Ve Ticaret",
      "Akmercan Adıyaman"
    ],
    "logoFile": "provider-gas-akmercan-adiyaman-dogal-gaz-dagitim-sanayi-ve-ticaret-as-official64.webp"
  },
  {
    "id": "gas-aksa-afyon-dogal-gaz-dagitim-as",
    "name": "Aksa Afyon Doğal Gaz Dağıtım",
    "domain": "aksadogalgaz.com.tr",
    "group": "gas",
    "regions": [
      "Afyonkarahisar"
    ],
    "aliases": [
      "Aksa Afyon Doğal Gaz Dağıtım A.Ş.",
      "Aksa Afyon Doğal Gaz Dağıtım",
      "Aksa Afyon"
    ],
    "logoFile": "provider-gas-aksa-afyon-dogal-gaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-aksa-agri-dogal-gaz-dagitim-as",
    "name": "Aksa Ağrı Doğal Gaz Dağıtım",
    "domain": "aksadogalgaz.com.tr",
    "group": "gas",
    "regions": [
      "Ağrı"
    ],
    "aliases": [
      "Aksa Ağrı Doğal Gaz Dağıtım A.Ş.",
      "Aksa Ağrı Doğal Gaz Dağıtım",
      "Aksa Ağrı"
    ],
    "logoFile": "provider-gas-aksa-agri-dogal-gaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-aksa-tokat-amasya-dogal-gaz-dagitim-as",
    "name": "Aksa Tokat Amasya Doğal Gaz Dağıtım",
    "domain": "aksadogalgaz.com.tr",
    "group": "gas",
    "regions": [
      "Amasya",
      "Tokat"
    ],
    "aliases": [
      "Aksa Tokat Amasya Doğal Gaz Dağıtım A.Ş.",
      "Aksa Tokat Amasya Doğal Gaz Dağıtım",
      "Aksa Tokat Amasya"
    ],
    "logoFile": "provider-gas-aksa-tokat-amasya-dogal-gaz-dagitim-as-official64.webp"
  },
  {
    "id": "baskentgaz",
    "name": "Başkent Doğalgaz Dağıtım Gayrimenkul Yatırım Ortaklığı",
    "domain": "baskentdogalgaz.com.tr",
    "group": "gas",
    "regions": [
      "Ankara"
    ],
    "aliases": [
      "Başkent Doğalgaz Dağıtım Gayrimenkul Yatırım Ortaklığı A.Ş.",
      "Başkent Doğalgaz Dağıtım Gayrimenkul Yatırım Ortaklığı",
      "Başkent"
    ],
    "logoFile": "provider-baskentgaz-official64.webp"
  },
  {
    "id": "gas-kizilcahamam-dogalgaz-dagitim-as",
    "name": "Kızılcahamam Doğalgaz Dağıtım",
    "domain": "kizilcahamamgaz.com",
    "group": "gas",
    "regions": [
      "Ankara"
    ],
    "aliases": [
      "Kızılcahamam Doğalgaz Dağıtım A.Ş.",
      "Kızılcahamam Doğalgaz Dağıtım",
      "Kızılcahamam"
    ],
    "logoFile": "provider-gas-kizilcahamam-dogalgaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-polgaz-polatli-dogalgaz-dagitim-as",
    "name": "Polgaz Polatlı Doğalgaz Dağıtım",
    "domain": "polgaz.com.tr",
    "group": "gas",
    "regions": [
      "Ankara"
    ],
    "aliases": [
      "Polgaz Polatlı Doğalgaz Dağıtım A.Ş.",
      "Polgaz Polatlı Doğalgaz Dağıtım",
      "Polgaz Polatlı"
    ],
    "logoFile": "provider-gas-polgaz-polatli-dogalgaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-enerya-antalya-gaz-dagitim-as",
    "name": "Enerya Antalya Gaz Dağıtım",
    "domain": "enerya.com.tr",
    "group": "gas",
    "regions": [
      "Antalya"
    ],
    "aliases": [
      "Enerya Antalya Gaz Dağıtım A.Ş.",
      "Enerya Antalya Gaz Dağıtım",
      "Enerya Antalya"
    ],
    "logoFile": "provider-gas-enerya-antalya-gaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-enerya-aksaray-gaz-dagitim-as",
    "name": "Enerya Aksaray Gaz Dağıtım",
    "domain": "enerya.com.tr",
    "group": "gas",
    "regions": [
      "Aksaray"
    ],
    "aliases": [
      "Enerya Aksaray Gaz Dağıtım A.Ş.",
      "Enerya Aksaray Gaz Dağıtım",
      "Enerya Aksaray"
    ],
    "logoFile": "provider-gas-enerya-aksaray-gaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-enerya-aydin-gaz-dagitim-as",
    "name": "Enerya Aydın Gaz Dağıtım",
    "domain": "enerya.com.tr",
    "group": "gas",
    "regions": [
      "Aydın"
    ],
    "aliases": [
      "Enerya Aydın Gaz Dağıtım A.Ş.",
      "Enerya Aydın Gaz Dağıtım",
      "Enerya Aydın"
    ],
    "logoFile": "provider-gas-enerya-aydin-gaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-dogugaz-kars-ardahan-dogalgaz-dagitim-as",
    "name": "DOGUGAZ Kars Ardahan Doğalgaz Dağıtım",
    "domain": "dogugaz.com.tr",
    "group": "gas",
    "regions": [
      "Ardahan",
      "Kars"
    ],
    "aliases": [
      "DOGUGAZ Kars Ardahan Doğalgaz Dağıtım A.Ş.",
      "DOGUGAZ Kars Ardahan Doğalgaz Dağıtım",
      "DOGUGAZ Kars Ardahan"
    ],
    "logoFile": "provider-gas-dogugaz-kars-ardahan-dogalgaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-aksa-balikesir-dogal-gaz-dagitim-as",
    "name": "Aksa Balıkesir Doğal Gaz Dağıtım",
    "domain": "aksadogalgaz.com.tr",
    "group": "gas",
    "regions": [
      "Balıkesir"
    ],
    "aliases": [
      "Aksa Balıkesir Doğal Gaz Dağıtım A.Ş.",
      "Aksa Balıkesir Doğal Gaz Dağıtım",
      "Aksa Balıkesir"
    ],
    "logoFile": "provider-gas-aksa-balikesir-dogal-gaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-aksa-bandirma-dogal-gaz-dagitim-as",
    "name": "Aksa Bandırma Doğal Gaz Dağıtım",
    "domain": "aksadogalgaz.com.tr",
    "group": "gas",
    "regions": [
      "Balıkesir"
    ],
    "aliases": [
      "Aksa Bandırma Doğal Gaz Dağıtım A.Ş.",
      "Aksa Bandırma Doğal Gaz Dağıtım",
      "Aksa Bandırma"
    ],
    "logoFile": "provider-gas-aksa-bandirma-dogal-gaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-aksa-canakkale-dogal-gaz-dagitim-as",
    "name": "Aksa Çanakkale Doğal Gaz Dağıtım",
    "domain": "aksadogalgaz.com.tr",
    "group": "gas",
    "regions": [
      "Balıkesir",
      "Çanakkale"
    ],
    "aliases": [
      "Aksa Çanakkale Doğal Gaz Dağıtım A.Ş.",
      "Aksa Çanakkale Doğal Gaz Dağıtım",
      "Aksa Çanakkale"
    ],
    "logoFile": "provider-gas-aksa-canakkale-dogal-gaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-aksa-mustafakemalpasa-susurluk-karacabey-dogal-gaz-dagitim-as",
    "name": "Aksa Mustafakemalpaşa Susurluk Karacabey Doğal Gaz Dağıtım",
    "domain": "aksadogalgaz.com.tr",
    "group": "gas",
    "regions": [
      "Balıkesir",
      "Bursa"
    ],
    "aliases": [
      "Aksa Mustafakemalpaşa Susurluk Karacabey Doğal Gaz Dağıtım A.Ş.",
      "Aksa Mustafakemalpaşa Susurluk Karacabey Doğal Gaz Dağıtım",
      "Aksa Mustafakemalpaşa Susurluk Karacabey"
    ],
    "logoFile": "provider-gas-aksa-mustafakemalpasa-susurluk-karacabey-dogal-gaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-akmercan-artvin-dogal-gaz-dagitim-sanayi-ve-ticaret-as",
    "name": "Akmercan Artvin Doğal Gaz Dağıtım Sanayi Ve Ticaret",
    "domain": "akmercanartvingaz.com.tr",
    "group": "gas",
    "regions": [
      "Artvin"
    ],
    "aliases": [
      "Akmercan Artvin Doğal Gaz Dağıtım Sanayi Ve Ticaret A.Ş.",
      "Akmercan Artvin Doğal Gaz Dağıtım Sanayi Ve Ticaret",
      "Akmercan Artvin"
    ],
    "logoFile": "provider-gas-akmercan-artvin-dogal-gaz-dagitim-sanayi-ve-ticaret-as-official64.webp"
  },
  {
    "id": "gas-aksa-siirt-batman-dogal-gaz-dagitim-as",
    "name": "Aksa Siirt Batman Doğal Gaz Dağıtım",
    "domain": "aksadogalgaz.com.tr",
    "group": "gas",
    "regions": [
      "Batman",
      "Siirt"
    ],
    "aliases": [
      "Aksa Siirt Batman Doğal Gaz Dağıtım A.Ş.",
      "Aksa Siirt Batman Doğal Gaz Dağıtım",
      "Aksa Siirt Batman"
    ],
    "logoFile": "provider-gas-aksa-siirt-batman-dogal-gaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-akmercan-batikar-dogal-gaz-dagitim-sanayi-ve-ticaret-as",
    "name": "Akmercan Batıkar Doğal Gaz Dağıtım Sanayi Ve Ticaret",
    "domain": "akmercanbatikargaz.com.tr",
    "group": "gas",
    "regions": [
      "Bartın",
      "Zonguldak"
    ],
    "aliases": [
      "Akmercan Batıkar Doğal Gaz Dağıtım Sanayi Ve Ticaret A.Ş.",
      "Akmercan Batıkar Doğal Gaz Dağıtım Sanayi Ve Ticaret",
      "Akmercan Batıkar"
    ],
    "logoFile": "provider-gas-akmercan-batikar-dogal-gaz-dagitim-sanayi-ve-ticaret-as-official64.webp"
  },
  {
    "id": "gas-aksa-gumushane-bayburt-dogal-gaz-dagitim-as",
    "name": "Aksa Gümüşhane Bayburt Doğal Gaz Dağıtım",
    "domain": "aksadogalgaz.com.tr",
    "group": "gas",
    "regions": [
      "Bayburt",
      "Gümüşhane"
    ],
    "aliases": [
      "Aksa Gümüşhane Bayburt Doğal Gaz Dağıtım A.Ş.",
      "Aksa Gümüşhane Bayburt Doğal Gaz Dağıtım",
      "Aksa Gümüşhane Bayburt"
    ],
    "logoFile": "provider-gas-aksa-gumushane-bayburt-dogal-gaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-aksa-bilecik-bolu-dogal-gaz-dagitim-as",
    "name": "Aksa Bilecik Bolu Doğal Gaz Dağıtım",
    "domain": "aksadogalgaz.com.tr",
    "group": "gas",
    "regions": [
      "Bilecik",
      "Bolu",
      "Eskişehir"
    ],
    "aliases": [
      "Aksa Bilecik Bolu Doğal Gaz Dağıtım A.Ş.",
      "Aksa Bilecik Bolu Doğal Gaz Dağıtım",
      "Aksa Bilecik Bolu"
    ],
    "logoFile": "provider-gas-aksa-bilecik-bolu-dogal-gaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-arh-dogalgaz-dagitim-as",
    "name": "ARH Doğalgaz Dağıtım",
    "domain": "arhdogalgaz.com.tr",
    "group": "gas",
    "regions": [
      "Bingöl"
    ],
    "aliases": [
      "ARH Doğalgaz Dağıtım A.Ş",
      "ARH Doğalgaz Dağıtım"
    ],
    "logoFile": "provider-gas-arh-dogalgaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-kargaz-dogalgaz-dagitim-sanayi-ve-ticaret-anonim-sirketi",
    "name": "Kargaz Doğalgaz Dağıtım Sanayi ve Ticaret",
    "domain": "kargaz.com.tr",
    "group": "gas",
    "regions": [
      "Bolu",
      "Çankırı",
      "Karabük",
      "Kastamonu"
    ],
    "aliases": [
      "Kargaz Doğalgaz Dağıtım Sanayi ve Ticaret Anonim Şirketi",
      "Kargaz Doğalgaz Dağıtım Sanayi ve Ticaret",
      "Kargaz"
    ],
    "logoFile": "provider-gas-kargaz-dogalgaz-dagitim-sanayi-ve-ticaret-anonim-sirketi-official64.webp"
  },
  {
    "id": "gas-dogugaz-bitlis-mus-dogalgaz-dagitim-as",
    "name": "Doğugaz Bitlis Muş Doğalgaz Dağıtım",
    "domain": "dogugaz.com.tr",
    "group": "gas",
    "regions": [
      "Bitlis",
      "Muş"
    ],
    "aliases": [
      "Doğugaz Bitlis Muş Doğalgaz Dağıtım A.Ş.",
      "Doğugaz Bitlis Muş Doğalgaz Dağıtım",
      "Doğugaz Bitlis Muş"
    ],
    "logoFile": "provider-gas-dogugaz-bitlis-mus-dogalgaz-dagitim-as-official64.webp"
  },
  {
    "id": "bursagaz",
    "name": "Aksa Bursa Doğal Gaz Dağıtım",
    "domain": "aksadogalgaz.com.tr",
    "group": "gas",
    "regions": [
      "Bursa"
    ],
    "aliases": [
      "Aksa Bursa Doğal Gaz Dağıtım A.Ş.",
      "Aksa Bursa Doğal Gaz Dağıtım",
      "Aksa Bursa"
    ],
    "logoFile": "provider-bursagaz-official64.webp"
  },
  {
    "id": "gas-aksa-gemlik-dogal-gaz-dagitim-as",
    "name": "Aksa Gemlik Doğal Gaz Dağıtım",
    "domain": "aksadogalgaz.com.tr",
    "group": "gas",
    "regions": [
      "Bursa"
    ],
    "aliases": [
      "Aksa Gemlik Doğal Gaz Dağıtım A.Ş.",
      "Aksa Gemlik Doğal Gaz Dağıtım",
      "Aksa Gemlik"
    ],
    "logoFile": "provider-gas-aksa-gemlik-dogal-gaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-armagaz-arsan-marmara-dogalgaz-dagitim-as",
    "name": "Armagaz Arsan Marmara Doğalgaz Dağıtım",
    "domain": "armagaz.com.tr",
    "group": "gas",
    "regions": [
      "Bursa",
      "Kocaeli",
      "Yalova"
    ],
    "aliases": [
      "Armagaz Arsan Marmara Doğalgaz Dağıtım A.Ş.",
      "Armagaz Arsan Marmara Doğalgaz Dağıtım",
      "Armagaz Arsan Marmara"
    ],
    "logoFile": "provider-gas-armagaz-arsan-marmara-dogalgaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-t-dogal-gaz-dagitim-as",
    "name": "T Doğal Gaz Dağıtım",
    "domain": "t-gaz.com.tr",
    "group": "gas",
    "regions": [
      "Bursa"
    ],
    "aliases": [
      "T Doğal Gaz Dağıtım A.Ş.",
      "T Doğal Gaz Dağıtım"
    ],
    "logoFile": "provider-gas-t-dogal-gaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-torosgaz-isparta-burdur-dogalgaz-dagitim-as",
    "name": "Torosgaz Isparta Burdur Doğalgaz Dağıtım",
    "domain": "torosgaz.com.tr",
    "group": "gas",
    "regions": [
      "Burdur",
      "Isparta"
    ],
    "aliases": [
      "Torosgaz Isparta Burdur Doğalgaz Dağıtım A.Ş.",
      "Torosgaz Isparta Burdur Doğalgaz Dağıtım",
      "Torosgaz Isparta Burdur"
    ],
    "logoFile": "provider-gas-torosgaz-isparta-burdur-dogalgaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-corum-dogal-gaz-dagitim-sanayi-ve-ticareti-as",
    "name": "Çorum Doğal Gaz Dağıtım Sanayi ve Ticareti",
    "domain": "corumgaz.com.tr",
    "group": "gas",
    "regions": [
      "Çorum"
    ],
    "aliases": [
      "Çorum Doğal Gaz Dağıtım Sanayi ve Ticareti A.Ş.",
      "Çorum Doğal Gaz Dağıtım Sanayi ve Ticareti"
    ],
    "logoFile": "provider-gas-corum-dogal-gaz-dagitim-sanayi-ve-ticareti-as-official64.webp"
  },
  {
    "id": "gas-enerya-denizli-gaz-dagitim-as",
    "name": "Enerya Denizli Gaz Dağıtım",
    "domain": "enerya.com.tr",
    "group": "gas",
    "regions": [
      "Denizli"
    ],
    "aliases": [
      "Enerya Denizli Gaz Dağıtım A.Ş.",
      "Enerya Denizli Gaz Dağıtım",
      "Enerya Denizli"
    ],
    "logoFile": "provider-gas-enerya-denizli-gaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-diyarbakir-dogalgaz-dagitim-as",
    "name": "Diyarbakır Doğalgaz Dağıtım",
    "domain": "diyargaz.com.tr",
    "group": "gas",
    "regions": [
      "Diyarbakır"
    ],
    "aliases": [
      "Diyarbakır Doğalgaz Dağıtım A.Ş.",
      "Diyarbakır Doğalgaz Dağıtım"
    ],
    "logoFile": "provider-gas-diyarbakir-dogalgaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-aksa-duzce-eregli-dogal-gaz-dagitim-as",
    "name": "Aksa Düzce Ereğli Doğal Gaz Dağıtım",
    "domain": "aksadogalgaz.com.tr",
    "group": "gas",
    "regions": [
      "Düzce",
      "Zonguldak"
    ],
    "aliases": [
      "Aksa Düzce Ereğli Doğal Gaz Dağıtım A.Ş.",
      "Aksa Düzce Ereğli Doğal Gaz Dağıtım",
      "Aksa Düzce Ereğli"
    ],
    "logoFile": "provider-gas-aksa-duzce-eregli-dogal-gaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-aksa-elazig-dogal-gaz-dagitim-as",
    "name": "Aksa Elazığ Doğal Gaz Dağıtım",
    "domain": "aksadogalgaz.com.tr",
    "group": "gas",
    "regions": [
      "Elazığ"
    ],
    "aliases": [
      "Aksa Elazığ Doğal Gaz Dağıtım A.Ş.",
      "Aksa Elazığ Doğal Gaz Dağıtım",
      "Aksa Elazığ"
    ],
    "logoFile": "provider-gas-aksa-elazig-dogal-gaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-gazdas-trakya-dogal-gaz-dagitim-as",
    "name": "GAZDAŞ Trakya Doğal Gaz Dağıtım",
    "domain": "gazdastrakya.com.tr",
    "group": "gas",
    "regions": [
      "Edirne",
      "Kırklareli",
      "Tekirdağ"
    ],
    "aliases": [
      "GAZDAŞ Trakya Doğal Gaz Dağıtım A.Ş.",
      "GAZDAŞ Trakya Doğal Gaz Dağıtım",
      "GAZDAŞ Trakya"
    ],
    "logoFile": "provider-gas-gazdas-trakya-dogal-gaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-enerya-erzincan-gaz-dagitim-as",
    "name": "Enerya Erzincan Gaz Dağıtım",
    "domain": "enerya.com.tr",
    "group": "gas",
    "regions": [
      "Erzincan"
    ],
    "aliases": [
      "Enerya Erzincan Gaz Dağıtım A.Ş.",
      "Enerya Erzincan Gaz Dağıtım",
      "Enerya Erzincan"
    ],
    "logoFile": "provider-gas-enerya-erzincan-gaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-eskisehir-dogal-gaz-dagitim-as",
    "name": "Eskişehir Doğal Gaz Dağıtım",
    "domain": "esgaz.com.tr",
    "group": "gas",
    "regions": [
      "Eskişehir"
    ],
    "aliases": [
      "Eskişehir Doğal Gaz Dağıtım A.Ş.",
      "Eskişehir Doğal Gaz Dağıtım"
    ],
    "logoFile": "provider-gas-eskisehir-dogal-gaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-palen-enerji-dogalgaz-dagitim-endustri-ve-ticaret-as",
    "name": "Palen Enerji Doğalgaz Dağıtım Endüstri ve Ticaret",
    "domain": "palen.com.tr",
    "group": "gas",
    "regions": [
      "Erzurum"
    ],
    "aliases": [
      "Palen Enerji Doğalgaz Dağıtım Endüstri ve Ticaret A.Ş.",
      "Palen Enerji Doğalgaz Dağıtım Endüstri ve Ticaret",
      "Palen Enerji"
    ],
    "logoFile": "provider-gas-palen-enerji-dogalgaz-dagitim-endustri-ve-ticaret-as-official64.webp"
  },
  {
    "id": "gas-gazdas-gaziantep-dogal-gaz-dagitim-as",
    "name": "GAZDAŞ Gaziantep Doğal Gaz Dağıtım",
    "domain": "gazdasgaziantep.com.tr",
    "group": "gas",
    "regions": [
      "Gaziantep",
      "Kilis"
    ],
    "aliases": [
      "GAZDAŞ Gaziantep Doğal Gaz Dağıtım A.Ş.",
      "GAZDAŞ Gaziantep Doğal Gaz Dağıtım",
      "GAZDAŞ Gaziantep"
    ],
    "logoFile": "provider-gas-gazdas-gaziantep-dogal-gaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-akmercan-hakkari-sirnak-dogal-gaz-dagitim-sanayi-ve-ticaret-as",
    "name": "Akmercan Hakkari Şırnak Doğal Gaz Dağıtım Sanayi Ve Ticaret",
    "domain": "akmercanhakkarisirnakgaz.com.tr",
    "group": "gas",
    "regions": [
      "Hakkari",
      "Şırnak"
    ],
    "aliases": [
      "Akmercan Hakkari Şırnak Doğal Gaz Dağıtım Sanayi Ve Ticaret A.Ş.",
      "Akmercan Hakkari Şırnak Doğal Gaz Dağıtım Sanayi Ve Ticaret",
      "Akmercan Hakkari Şırnak"
    ],
    "logoFile": "provider-gas-akmercan-hakkari-sirnak-dogal-gaz-dagitim-sanayi-ve-ticaret-as-official64.webp"
  },
  {
    "id": "gas-aksa-ordu-giresun-dogal-gaz-dagitim-as",
    "name": "Aksa Ordu Giresun Doğal Gaz Dağıtım",
    "domain": "aksadogalgaz.com.tr",
    "group": "gas",
    "regions": [
      "Giresun",
      "Ordu",
      "Samsun"
    ],
    "aliases": [
      "Aksa Ordu Giresun Doğal Gaz Dağıtım A.Ş.",
      "Aksa Ordu Giresun Doğal Gaz Dağıtım",
      "Aksa Ordu Giresun"
    ],
    "logoFile": "provider-gas-aksa-ordu-giresun-dogal-gaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-bahcesehir-gaz-dagitim-as",
    "name": "Bahçeşehir Gaz Dağıtım",
    "domain": "bahcesehirgaz.com.tr",
    "group": "gas",
    "regions": [
      "İstanbul"
    ],
    "aliases": [
      "Bahçeşehir Gaz Dağıtım A.Ş.",
      "Bahçeşehir Gaz Dağıtım",
      "Bahçeşehir"
    ],
    "logoFile": "provider-gas-bahcesehir-gaz-dagitim-as-official64.webp"
  },
  {
    "id": "igdas",
    "name": "İstanbul Gaz Dağıtım Sanayi ve Ticaret",
    "domain": "igdas.istanbul",
    "group": "gas",
    "regions": [
      "İstanbul"
    ],
    "aliases": [
      "İstanbul Gaz Dağıtım Sanayi ve Ticaret A.Ş.",
      "İstanbul Gaz Dağıtım Sanayi ve Ticaret"
    ],
    "logoFile": "provider-igdas-official64.webp"
  },
  {
    "id": "gas-dogugaz-igdir-dogalgaz-dagitim-as",
    "name": "DOGUGAZ Iğdır Doğalgaz Dağıtım",
    "domain": "dogugaz.com.tr",
    "group": "gas",
    "regions": [
      "Iğdır"
    ],
    "aliases": [
      "DOGUGAZ Iğdır Doğalgaz Dağıtım A.Ş.",
      "DOGUGAZ Iğdır Doğalgaz Dağıtım",
      "DOGUGAZ Iğdır"
    ],
    "logoFile": "provider-gas-dogugaz-igdir-dogalgaz-dagitim-as-official64.webp"
  },
  {
    "id": "izmirgaz",
    "name": "İzmir Doğalgaz Dağıtım",
    "domain": "izmirgaz.com.tr",
    "group": "gas",
    "regions": [
      "İzmir"
    ],
    "aliases": [
      "İzmir Doğalgaz Dağıtım A.Ş.",
      "İzmir Doğalgaz Dağıtım"
    ],
    "logoFile": "provider-izmirgaz-official64.webp"
  },
  {
    "id": "gas-enerya-karaman-gaz-dagitim-as",
    "name": "Enerya Karaman Gaz Dağıtım",
    "domain": "enerya.com.tr",
    "group": "gas",
    "regions": [
      "Karaman"
    ],
    "aliases": [
      "Enerya Karaman Gaz Dağıtım A.Ş.",
      "Enerya Karaman Gaz Dağıtım",
      "Enerya Karaman"
    ],
    "logoFile": "provider-gas-enerya-karaman-gaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-armadas-arsan-maras-dogal-gaz-dagitim-as",
    "name": "Armadaş Arsan Maraş Doğal Gaz Dağıtım",
    "domain": "armadas.com.tr",
    "group": "gas",
    "regions": [
      "Kahramanmaraş"
    ],
    "aliases": [
      "Armadaş Arsan Maraş Doğal Gaz Dağıtım A.Ş",
      "Armadaş Arsan Maraş Doğal Gaz Dağıtım",
      "Armadaş Arsan Maraş"
    ],
    "logoFile": "provider-gas-armadas-arsan-maras-dogal-gaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-aksa-kayseri-dogal-gaz-dagitim-as",
    "name": "Aksa Kayseri Doğal Gaz Dağıtım",
    "domain": "aksadogalgaz.com.tr",
    "group": "gas",
    "regions": [
      "Kayseri"
    ],
    "aliases": [
      "Aksa Kayseri Doğal Gaz Dağıtım A.Ş.",
      "Aksa Kayseri Doğal Gaz Dağıtım",
      "Aksa Kayseri"
    ],
    "logoFile": "provider-gas-aksa-kayseri-dogal-gaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-kirgaz-kirikkale-dogalgaz-dagitim-pazarlama-as",
    "name": "Kırgaz Kırıkkale Doğalgaz Dağıtım Pazarlama",
    "domain": "kirgaz.com.tr",
    "group": "gas",
    "regions": [
      "Kırıkkale"
    ],
    "aliases": [
      "Kırgaz Kırıkkale Doğalgaz Dağıtım Pazarlama A.Ş.",
      "Kırgaz Kırıkkale Doğalgaz Dağıtım Pazarlama",
      "Kırgaz Kırıkkale"
    ],
    "logoFile": "provider-gas-kirgaz-kirikkale-dogalgaz-dagitim-pazarlama-as-official64.webp"
  },
  {
    "id": "gas-kirgaz-kirsehir-dogalgaz-dagitim-pazarlama-as",
    "name": "Kırgaz Kırşehir Doğalgaz Dağıtım Pazarlama",
    "domain": "kirgaz.com.tr",
    "group": "gas",
    "regions": [
      "Kırşehir"
    ],
    "aliases": [
      "Kırgaz Kırşehir Doğalgaz Dağıtım Pazarlama A.Ş.",
      "Kırgaz Kırşehir Doğalgaz Dağıtım Pazarlama",
      "Kırgaz Kırşehir"
    ],
    "logoFile": "provider-gas-kirgaz-kirsehir-dogalgaz-dagitim-pazarlama-as-official64.webp"
  },
  {
    "id": "gas-surmeli-dogal-gaz-dagitim-sanayi-ve-ticaret-anonim-sirketi",
    "name": "Sürmeli Doğal Gaz Dağıtım Sanayi ve Ticaret",
    "domain": "surmeligaz.com.tr",
    "group": "gas",
    "regions": [
      "Kırşehir",
      "Yozgat"
    ],
    "aliases": [
      "Sürmeli Doğal Gaz Dağıtım Sanayi ve Ticaret Anonim Şirketi",
      "Sürmeli Doğal Gaz Dağıtım Sanayi ve Ticaret",
      "Sürmeli"
    ],
    "logoFile": "provider-gas-surmeli-dogal-gaz-dagitim-sanayi-ve-ticaret-anonim-sirketi-official64.webp"
  },
  {
    "id": "izgaz",
    "name": "İzgaz İzmit Gaz Dağıtım Sanayi ve Ticaret",
    "domain": "izgaz.com.tr",
    "group": "gas",
    "regions": [
      "Kocaeli"
    ],
    "aliases": [
      "İzgaz İzmit Gaz Dağıtım Sanayi ve Ticaret A.Ş.",
      "İzgaz İzmit Gaz Dağıtım Sanayi ve Ticaret",
      "İzgaz İzmit"
    ],
    "logoFile": "provider-izgaz-official64.webp"
  },
  {
    "id": "gas-palgaz-dogalgaz-dagitim-san-ve-tic-as",
    "name": "Palgaz Doğalgaz Dağıtım San. ve Tic.",
    "domain": "palgaz.com.tr",
    "group": "gas",
    "regions": [
      "Kocaeli"
    ],
    "aliases": [
      "Palgaz Doğalgaz Dağıtım San. ve Tic. A.Ş.",
      "Palgaz Doğalgaz Dağıtım San. ve Tic.",
      "Palgaz"
    ],
    "logoFile": "provider-gas-palgaz-dogalgaz-dagitim-san-ve-tic-as-official64.webp"
  },
  {
    "id": "gas-enerya-eregli-gaz-dagitim-as",
    "name": "Enerya Ereğli Gaz Dağıtım",
    "domain": "enerya.com.tr",
    "group": "gas",
    "regions": [
      "Konya"
    ],
    "aliases": [
      "Enerya Ereğli Gaz Dağıtım A.Ş.",
      "Enerya Ereğli Gaz Dağıtım",
      "Enerya Ereğli"
    ],
    "logoFile": "provider-gas-enerya-eregli-gaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-enerya-konya-gaz-dagitim-as",
    "name": "Enerya Konya Gaz Dağıtım",
    "domain": "enerya.com.tr",
    "group": "gas",
    "regions": [
      "Konya"
    ],
    "aliases": [
      "Enerya Konya Gaz Dağıtım A.Ş.",
      "Enerya Konya Gaz Dağıtım",
      "Enerya Konya"
    ],
    "logoFile": "provider-gas-enerya-konya-gaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-selcuk-dogal-gaz-dagitim-as",
    "name": "Selçuk Doğal Gaz Dağıtım",
    "domain": "selcukgaz.com.tr",
    "group": "gas",
    "regions": [
      "Konya"
    ],
    "aliases": [
      "Selçuk Doğal Gaz Dağıtım A.Ş",
      "Selçuk Doğal Gaz Dağıtım",
      "Selçuk"
    ],
    "logoFile": "provider-gas-selcuk-dogal-gaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-torosgaz-kutahya-dogalgaz-dagitim-as",
    "name": "Torosgaz Kütahya Doğalgaz Dağıtım",
    "domain": "torosgazkutahya.com.tr",
    "group": "gas",
    "regions": [
      "Kütahya"
    ],
    "aliases": [
      "Torosgaz Kütahya Doğalgaz Dağıtım A.Ş.",
      "Torosgaz Kütahya Doğalgaz Dağıtım",
      "Torosgaz Kütahya"
    ],
    "logoFile": "provider-gas-torosgaz-kutahya-dogalgaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-aksa-malatya-dogal-gaz-dagitim-as",
    "name": "Aksa Malatya Doğal Gaz Dağıtım",
    "domain": "aksadogalgaz.com.tr",
    "group": "gas",
    "regions": [
      "Malatya"
    ],
    "aliases": [
      "Aksa Malatya Doğal Gaz Dağıtım A.Ş.",
      "Aksa Malatya Doğal Gaz Dağıtım",
      "Aksa Malatya"
    ],
    "logoFile": "provider-gas-aksa-malatya-dogal-gaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-aksa-manisa-dogal-gaz-dagitim-as",
    "name": "Aksa Manisa Doğal Gaz Dağıtım",
    "domain": "aksadogalgaz.com.tr",
    "group": "gas",
    "regions": [
      "Manisa"
    ],
    "aliases": [
      "Aksa Manisa Doğal Gaz Dağıtım A.Ş.",
      "Aksa Manisa Doğal Gaz Dağıtım",
      "Aksa Manisa"
    ],
    "logoFile": "provider-gas-aksa-manisa-dogal-gaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-akmercan-mardin-dogal-gaz-dagitim-sanayi-ve-ticaret-as",
    "name": "Akmercan Mardin Doğal Gaz Dağıtım Sanayi Ve Ticaret",
    "domain": "akmercanmardingaz.com.tr",
    "group": "gas",
    "regions": [
      "Mardin"
    ],
    "aliases": [
      "Akmercan Mardin Doğal Gaz Dağıtım Sanayi Ve Ticaret A.Ş.",
      "Akmercan Mardin Doğal Gaz Dağıtım Sanayi Ve Ticaret",
      "Akmercan Mardin"
    ],
    "logoFile": "provider-gas-akmercan-mardin-dogal-gaz-dagitim-sanayi-ve-ticaret-as-official64.webp"
  },
  {
    "id": "gas-akmercan-mugla-dogal-gaz-dagitim-sanayi-ve-ticaret-as",
    "name": "Akmercan Muğla Doğal Gaz Dağıtım Sanayi Ve Ticaret",
    "domain": "akmercanmuglagaz.com.tr",
    "group": "gas",
    "regions": [
      "Muğla"
    ],
    "aliases": [
      "Akmercan Muğla Doğal Gaz Dağıtım Sanayi Ve Ticaret A.Ş.",
      "Akmercan Muğla Doğal Gaz Dağıtım Sanayi Ve Ticaret",
      "Akmercan Muğla"
    ],
    "logoFile": "provider-gas-akmercan-mugla-dogal-gaz-dagitim-sanayi-ve-ticaret-as-official64.webp"
  },
  {
    "id": "gas-enerya-kapadokya-gaz-dagitim-as",
    "name": "Enerya Kapadokya Gaz Dağıtım",
    "domain": "enerya.com.tr",
    "group": "gas",
    "regions": [
      "Niğde",
      "Nevşehir"
    ],
    "aliases": [
      "Enerya Kapadokya Gaz Dağıtım A.Ş.",
      "Enerya Kapadokya Gaz Dağıtım",
      "Enerya Kapadokya"
    ],
    "logoFile": "provider-gas-enerya-kapadokya-gaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-aksa-karadeniz-dogal-gaz-dagitim-as",
    "name": "Aksa Karadeniz Doğal Gaz Dağıtım",
    "domain": "aksadogalgaz.com.tr",
    "group": "gas",
    "regions": [
      "Rize",
      "Trabzon"
    ],
    "aliases": [
      "Aksa Karadeniz Doğal Gaz Dağıtım A.Ş.",
      "Aksa Karadeniz Doğal Gaz Dağıtım",
      "Aksa Karadeniz"
    ],
    "logoFile": "provider-gas-aksa-karadeniz-dogal-gaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-akmercan-delta-dogalgaz-dagitim-sanayi-ve-ticaret-as",
    "name": "Akmercan Delta Doğalgaz Dağıtım Sanayi Ve Ticaret",
    "domain": "akmercandeltagaz.com.tr",
    "group": "gas",
    "regions": [
      "Samsun"
    ],
    "aliases": [
      "Akmercan Delta Doğalgaz Dağıtım Sanayi Ve Ticaret A.Ş.",
      "Akmercan Delta Doğalgaz Dağıtım Sanayi Ve Ticaret",
      "Akmercan Delta"
    ],
    "logoFile": "provider-gas-akmercan-delta-dogalgaz-dagitim-sanayi-ve-ticaret-as-official64.webp"
  },
  {
    "id": "gas-samgaz-dogal-gaz-dagitim-as",
    "name": "Samgaz Doğal Gaz Dağıtım",
    "domain": "samgaz.com.tr",
    "group": "gas",
    "regions": [
      "Samsun"
    ],
    "aliases": [
      "Samgaz Doğal Gaz Dağıtım A.Ş.",
      "Samgaz Doğal Gaz Dağıtım",
      "Samgaz"
    ],
    "logoFile": "provider-gas-samgaz-dogal-gaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-akmercan-gepa-dogal-gaz-dagitim-sanayi-ve-ticaret-as",
    "name": "Akmercan Gepa Doğal Gaz Dağıtım Sanayi Ve Ticaret",
    "domain": "akmercangepagaz.com.tr",
    "group": "gas",
    "regions": [
      "Sakarya"
    ],
    "aliases": [
      "Akmercan Gepa Doğal Gaz Dağıtım Sanayi Ve Ticaret A.Ş.",
      "Akmercan Gepa Doğal Gaz Dağıtım Sanayi Ve Ticaret",
      "Akmercan Gepa"
    ],
    "logoFile": "provider-gas-akmercan-gepa-dogal-gaz-dagitim-sanayi-ve-ticaret-as-official64.webp"
  },
  {
    "id": "gas-aksa-sakarya-dogal-gaz-dagitim-as",
    "name": "AKSA Sakarya Doğal Gaz Dağıtım",
    "domain": "agdas.com.tr",
    "group": "gas",
    "regions": [
      "Sakarya"
    ],
    "aliases": [
      "AKSA Sakarya Doğal Gaz Dağıtım A.Ş.",
      "AKSA Sakarya Doğal Gaz Dağıtım",
      "AKSA Sakarya"
    ],
    "logoFile": "provider-gas-aksa-sakarya-dogal-gaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-aksa-sivas-dogal-gaz-dagitim-as",
    "name": "Aksa Sivas Doğal Gaz Dağıtım",
    "domain": "aksadogalgaz.com.tr",
    "group": "gas",
    "regions": [
      "Sivas"
    ],
    "aliases": [
      "Aksa Sivas Doğal Gaz Dağıtım A.Ş.",
      "Aksa Sivas Doğal Gaz Dağıtım",
      "Aksa Sivas"
    ],
    "logoFile": "provider-gas-aksa-sivas-dogal-gaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-aksa-sanliurfa-dogal-gaz-dagitim-as",
    "name": "Aksa Şanlıurfa Doğal Gaz Dağıtım",
    "domain": "aksadogalgaz.com.tr",
    "group": "gas",
    "regions": [
      "Şanlıurfa"
    ],
    "aliases": [
      "Aksa Şanlıurfa Doğal Gaz Dağıtım A.Ş.",
      "Aksa Şanlıurfa Doğal Gaz Dağıtım",
      "Aksa Şanlıurfa"
    ],
    "logoFile": "provider-gas-aksa-sanliurfa-dogal-gaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-akmercan-sinop-dogal-gaz-dagitim-sanayi-ve-ticaret-as",
    "name": "Akmercan Sinop Doğal Gaz Dağıtım Sanayi Ve Ticaret",
    "domain": "akmercansinopgaz.com.tr",
    "group": "gas",
    "regions": [
      "Sinop"
    ],
    "aliases": [
      "Akmercan Sinop Doğal Gaz Dağıtım Sanayi Ve Ticaret A.Ş.",
      "Akmercan Sinop Doğal Gaz Dağıtım Sanayi Ve Ticaret",
      "Akmercan Sinop"
    ],
    "logoFile": "provider-gas-akmercan-sinop-dogal-gaz-dagitim-sanayi-ve-ticaret-as-official64.webp"
  },
  {
    "id": "gas-cordas-corlu-dogalgaz-dagitim-as",
    "name": "Çordaş Çorlu Doğalgaz Dağıtım",
    "domain": "marmarayalovagaz.com.tr",
    "group": "gas",
    "regions": [
      "Tekirdağ"
    ],
    "aliases": [
      "Çordaş Çorlu Doğalgaz Dağıtım A.Ş.",
      "Çordaş Çorlu Doğalgaz Dağıtım",
      "Çordaş Çorlu"
    ],
    "logoFile": "provider-gas-cordas-corlu-dogalgaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-akmercan-tunceli-dogal-gaz-dagitim-sanayi-ve-ticaret-as",
    "name": "Akmercan Tunceli Doğal Gaz Dağıtım Sanayi Ve Ticaret",
    "domain": "akmercantunceligaz.com.tr",
    "group": "gas",
    "regions": [
      "Tunceli"
    ],
    "aliases": [
      "Akmercan Tunceli Doğal Gaz Dağıtım Sanayi Ve Ticaret A.Ş.",
      "Akmercan Tunceli Doğal Gaz Dağıtım Sanayi Ve Ticaret",
      "Akmercan Tunceli"
    ],
    "logoFile": "provider-gas-akmercan-tunceli-dogal-gaz-dagitim-sanayi-ve-ticaret-as-official64.webp"
  },
  {
    "id": "gas-aksa-van-dogal-gaz-dagitim-as",
    "name": "Aksa Van Doğal Gaz Dağıtım",
    "domain": "aksadogalgaz.com.tr",
    "group": "gas",
    "regions": [
      "Van"
    ],
    "aliases": [
      "Aksa Van Doğal Gaz Dağıtım A.Ş.",
      "Aksa Van Doğal Gaz Dağıtım",
      "Aksa Van"
    ],
    "logoFile": "provider-gas-aksa-van-dogal-gaz-dagitim-as-official64.webp"
  },
  {
    "id": "gas-udas-usak-dogal-gaz-dagitim-sanayi-ve-ticaret-as",
    "name": "Udaş Uşak Doğal Gaz Dağıtım Sanayi ve Ticaret",
    "domain": "udas.com.tr",
    "group": "gas",
    "regions": [
      "Uşak"
    ],
    "aliases": [
      "Udaş Uşak Doğal Gaz Dağıtım Sanayi ve Ticaret A.Ş.",
      "Udaş Uşak Doğal Gaz Dağıtım Sanayi ve Ticaret",
      "Udaş Uşak"
    ],
    "logoFile": "provider-gas-udas-usak-dogal-gaz-dagitim-sanayi-ve-ticaret-as-official64.webp"
  },
  {
    "id": "electricity_retail-akedas-elektrik-perakende-satis-anonim-sirketi",
    "name": "AKEDAŞ Elektrik Perakende Satış",
    "domain": "akedas.com.tr",
    "group": "electricity_retail",
    "regions": [
      "Adıyaman",
      "Kahramanmaraş"
    ],
    "aliases": [
      "AKEDAŞ Elektrik Perakende Satış Anonim Şirketi",
      "AKEDAŞ Elektrik Perakende Satış"
    ],
    "logoFile": "provider-electricity_retail-akedas-elektrik-perakende-satis-anonim-sirketi-official64.webp"
  },
  {
    "id": "enerjisa",
    "name": "Enerjisa Toroslar Elektrik Perakende Satış",
    "domain": "enerjisa.com.tr",
    "group": "electricity_retail",
    "regions": [
      "Adana",
      "Gaziantep",
      "Hatay",
      "Kilis",
      "Mersin",
      "Osmaniye",
      "Ankara",
      "Bartın",
      "Çankırı",
      "Karabük",
      "Kastamonu",
      "Kırıkkale",
      "Zonguldak",
      "İstanbul"
    ],
    "aliases": [
      "Enerjisa Toroslar Elektrik Perakende Satış A.Ş.",
      "Enerjisa Toroslar Elektrik Perakende Satış",
      "Enerjisa Başkent Elektrik Perakende Satış A.Ş.",
      "Enerjisa Başkent Elektrik Perakende Satış",
      "Enerjisa İstanbul Anadolu Yakası Elektrik Perakende Satış A.Ş.",
      "Enerjisa İstanbul Anadolu Yakası Elektrik Perakende Satış"
    ],
    "logoFile": "provider-enerjisa-official64.webp"
  },
  {
    "id": "electricity_retail-osmangazi-elektrik-perakende-satis-as",
    "name": "Osmangazi Elektrik Perakende Satış",
    "domain": "oepsas.com.tr",
    "group": "electricity_retail",
    "regions": [
      "Afyonkarahisar",
      "Bilecik",
      "Eskişehir",
      "Kütahya",
      "Uşak"
    ],
    "aliases": [
      "Osmangazi Elektrik Perakende Satış A.Ş",
      "Osmangazi Elektrik Perakende Satış"
    ],
    "logoFile": "provider-electricity_retail-osmangazi-elektrik-perakende-satis-as-official64.webp"
  },
  {
    "id": "electricity_retail-aras-elektrik-perakende-satis-as",
    "name": "Aras Elektrik Perakende Satış",
    "domain": "arasepas.com",
    "group": "electricity_retail",
    "regions": [
      "Ağrı",
      "Ardahan",
      "Bayburt",
      "Erzincan",
      "Erzurum",
      "Iğdır",
      "Kars"
    ],
    "aliases": [
      "Aras Elektrik Perakende Satış A.Ş",
      "Aras Elektrik Perakende Satış"
    ],
    "logoFile": "provider-electricity_retail-aras-elektrik-perakende-satis-as-official64.webp"
  },
  {
    "id": "electricity_retail-meram-elektrik-perakende-satis-anonim-sirketi",
    "name": "Meram Elektrik Perakende Satış",
    "domain": "mepasenerji.com",
    "group": "electricity_retail",
    "regions": [
      "Aksaray",
      "Karaman",
      "Kırşehir",
      "Konya",
      "Nevşehir",
      "Niğde"
    ],
    "aliases": [
      "Meram Elektrik Perakende Satış Anonim Şirketi",
      "Meram Elektrik Perakende Satış"
    ],
    "logoFile": "provider-electricity_retail-meram-elektrik-perakende-satis-anonim-sirketi-official64.webp"
  },
  {
    "id": "electricity_retail-yesilirmak-elektrik-perakende-satis-as",
    "name": "Yeşilırmak Elektrik Perakende Satış",
    "domain": "yepas.com",
    "group": "electricity_retail",
    "regions": [
      "Amasya",
      "Çorum",
      "Ordu",
      "Samsun",
      "Sinop"
    ],
    "aliases": [
      "Yeşilırmak Elektrik Perakende Satış A.Ş",
      "Yeşilırmak Elektrik Perakende Satış"
    ],
    "logoFile": "provider-electricity_retail-yesilirmak-elektrik-perakende-satis-as-official64.webp"
  },
  {
    "id": "ckakdeniz",
    "name": "CK Akdeniz Elektrik Perakende Satış",
    "domain": "ckakdeniz.com.tr",
    "group": "electricity_retail",
    "regions": [
      "Antalya",
      "Burdur",
      "Isparta"
    ],
    "aliases": [
      "CK Akdeniz Elektrik Perakende Satış A.Ş.",
      "CK Akdeniz Elektrik Perakende Satış"
    ],
    "logoFile": "provider-ckakdeniz-official64.webp"
  },
  {
    "id": "electricity_retail-aksa-coruh-elektrik-perakende-satis-as",
    "name": "Aksa Çoruh Elektrik Perakende Satış",
    "domain": "aksacoruh.com",
    "group": "electricity_retail",
    "regions": [
      "Artvin",
      "Giresun",
      "Gümüşhane",
      "Rize",
      "Trabzon"
    ],
    "aliases": [
      "Aksa Çoruh Elektrik Perakende Satış A.Ş.",
      "Aksa Çoruh Elektrik Perakende Satış"
    ],
    "logoFile": "provider-electricity_retail-aksa-coruh-elektrik-perakende-satis-as-official64.webp"
  },
  {
    "id": "aydemperakende",
    "name": "Aydem Elektrik Perakende Satış",
    "domain": "aydemperakende.com.tr",
    "group": "electricity_retail",
    "regions": [
      "Aydın",
      "Denizli",
      "Muğla"
    ],
    "aliases": [
      "Aydem Elektrik Perakende Satış A.Ş",
      "Aydem Elektrik Perakende Satış"
    ],
    "logoFile": "provider-aydemperakende-official64.webp"
  },
  {
    "id": "uludagelektrik",
    "name": "Uludağ Perakende Elektrik Satış",
    "domain": "uludagelektrik.com.tr",
    "group": "electricity_retail",
    "regions": [
      "Balıkesir",
      "Bursa",
      "Çanakkale",
      "Yalova"
    ],
    "aliases": [
      "Uludağ Perakende Elektrik Satış A.Ş.",
      "Uludağ Perakende Elektrik Satış"
    ],
    "logoFile": "provider-uludagelektrik-official64.webp"
  },
  {
    "id": "electricity_retail-dicle-elektrik-perakende-satis-as",
    "name": "Dicle Elektrik Perakende Satış",
    "domain": "depsas.com.tr",
    "group": "electricity_retail",
    "regions": [
      "Batman",
      "Diyarbakır",
      "Mardin",
      "Siirt",
      "Şanlıurfa",
      "Şırnak"
    ],
    "aliases": [
      "Dicle Elektrik Perakende Satış A.Ş",
      "Dicle Elektrik Perakende Satış"
    ],
    "logoFile": "provider-electricity_retail-dicle-elektrik-perakende-satis-as-official64.webp"
  },
  {
    "id": "electricity_retail-aksa-firat-elektrik-perakende-satis-as",
    "name": "Aksa Fırat Elektrik Perakende Satış",
    "domain": "aksafirat.com",
    "group": "electricity_retail",
    "regions": [
      "Bingöl",
      "Elazığ",
      "Malatya",
      "Tunceli"
    ],
    "aliases": [
      "Aksa Fırat Elektrik Perakende Satış A.Ş.",
      "Aksa Fırat Elektrik Perakende Satış"
    ],
    "logoFile": "provider-electricity_retail-aksa-firat-elektrik-perakende-satis-as-official64.webp"
  },
  {
    "id": "sepas",
    "name": "Sakarya Elektrik Perakende Satış",
    "domain": "sepas.com.tr",
    "group": "electricity_retail",
    "regions": [
      "Bolu",
      "Düzce",
      "Kocaeli",
      "Sakarya"
    ],
    "aliases": [
      "Sakarya Elektrik Perakende Satış A.Ş.",
      "Sakarya Elektrik Perakende Satış"
    ],
    "logoFile": "provider-sepas-official64.webp"
  },
  {
    "id": "electricity_retail-turkerler-vangolu-elektrik-perakende-satis-as",
    "name": "Türkerler Vangölü Elektrik Perakende Satış",
    "domain": "vepsas.com.tr",
    "group": "electricity_retail",
    "regions": [
      "Bitlis",
      "Hakkari",
      "Muş",
      "Van"
    ],
    "aliases": [
      "Türkerler Vangölü Elektrik Perakende Satış A.Ş",
      "Türkerler Vangölü Elektrik Perakende Satış"
    ],
    "logoFile": "provider-electricity_retail-turkerler-vangolu-elektrik-perakende-satis-as-official64.webp"
  },
  {
    "id": "trepas",
    "name": "Trakya Elektrik Perakende Satış",
    "domain": "trepas.com.tr",
    "group": "electricity_retail",
    "regions": [
      "Edirne",
      "Kırklareli",
      "Tekirdağ"
    ],
    "aliases": [
      "Trakya Elektrik Perakende Satış A.Ş",
      "Trakya Elektrik Perakende Satış"
    ],
    "logoFile": "provider-trepas-official64.webp"
  },
  {
    "id": "ckbogazici",
    "name": "CK Boğaziçi Elektrik Perakende Satış",
    "domain": "ckbogazici.com.tr",
    "group": "electricity_retail",
    "regions": [
      "İstanbul"
    ],
    "aliases": [
      "CK Boğaziçi Elektrik Perakende Satış A.Ş.",
      "CK Boğaziçi Elektrik Perakende Satış"
    ],
    "logoFile": "provider-ckbogazici-official64.webp"
  },
  {
    "id": "gedizperakende",
    "name": "Gediz Elektrik Perakende Satış",
    "domain": "gedizperakende.com.tr",
    "group": "electricity_retail",
    "regions": [
      "İzmir",
      "Manisa"
    ],
    "aliases": [
      "Gediz Elektrik Perakende Satış A.Ş",
      "Gediz Elektrik Perakende Satış"
    ],
    "logoFile": "provider-gedizperakende-official64.webp"
  },
  {
    "id": "electricity_retail-kayseri-elektrik-perakende-satis-anonim-sirketi",
    "name": "Kayseri Elektrik Perakende Satış",
    "domain": "kepsas.com.tr",
    "group": "electricity_retail",
    "regions": [
      "Kayseri"
    ],
    "aliases": [
      "Kayseri Elektrik Perakende Satış Anonim Şirketi",
      "Kayseri Elektrik Perakende Satış"
    ],
    "logoFile": "provider-electricity_retail-kayseri-elektrik-perakende-satis-anonim-sirketi-official64.webp"
  },
  {
    "id": "ckcamlibel",
    "name": "CK Çamlıbel Elektrik Perakende Satış",
    "domain": "ckcamlibel.com.tr",
    "group": "electricity_retail",
    "regions": [
      "Sivas",
      "Tokat",
      "Yozgat"
    ],
    "aliases": [
      "CK Çamlıbel Elektrik Perakende Satış A.Ş.",
      "CK Çamlıbel Elektrik Perakende Satış"
    ],
    "logoFile": "provider-ckcamlibel-official64.webp"
  },
  {
    "id": "aksadogalgaz",
    "name": "Aksa Doğalgaz",
    "domain": "aksadogalgaz.com.tr",
    "group": "gas",
    "regions": [
      "Adana",
      "Afyonkarahisar",
      "Ağrı",
      "Amasya",
      "Balıkesir",
      "Batman",
      "Bayburt",
      "Bilecik",
      "Bolu",
      "Bursa",
      "Çanakkale",
      "Düzce",
      "Elazığ",
      "Eskişehir",
      "Giresun",
      "Gümüşhane",
      "Hatay",
      "Kayseri",
      "Malatya",
      "Manisa",
      "Mersin",
      "Ordu",
      "Osmaniye",
      "Rize",
      "Samsun",
      "Siirt",
      "Sivas",
      "Şanlıurfa",
      "Tokat",
      "Trabzon",
      "Van",
      "Zonguldak"
    ],
    "aliases": [
      "Aksa Doğalgaz"
    ]
  },
  {
    "id": "enerya",
    "name": "Enerya",
    "domain": "enerya.com.tr",
    "group": "gas",
    "regions": [
      "Aksaray",
      "Antalya",
      "Aydın",
      "Denizli",
      "Erzincan",
      "Karaman",
      "Konya",
      "Nevşehir",
      "Niğde"
    ],
    "aliases": [
      "Enerya"
    ]
  }
];
