import { paymentMethodsService } from "@/services/paymentMethods";
import type { PaymentMethod } from "@/types";

const PAYMENT_ICON_MAP: Record<string, string> = {
  visa: "Visa.png",
  mastercard: "Mastercard.png",
  "american express": "Amex.png",
  amex: "Amex.png",
  discover: "Discover.png",
  "diners club": "DinersClub.png",
  jcb: "JCB.png",
  unionpay: "unionpay.png",
  "union pay": "unionpay.png",
  maestro: "Maestro.png",
  paypal: "PayPal.png",
  "apple pay": "ApplePay.png",
  "google pay": "GooglePay.png",
  "samsung pay": "samsungpay.png",
  "amazon pay": "amazonpay.png",
  alipay: "alipay.png",
  "wechat pay": "wechat.png",
  wechat: "wechat.png",
  venmo: "venmo.png",
  stripe: "Stripe.png",
  klarna: "Klarna.png",
  affirm: "affirm.png",
  skrill: "skrill.png",
  paysafecard: "paysafe.png",
  paysafe: "paysafe.png",
  ideal: "ideal.png",
  bancontact: "bancontact.png",
  giropay: "gitopay.png",
  sofort: "sofort.png",
  payoneer: "Payoneer.png",
  interac: "Interac.png",
  bitcoin: "Bitcoin.png",
  "bitcoin cash": "BitcoinCash.png",
  ethereum: "Etherium.png",
  litecoin: "Lightcoin.png",
  yandex: "Yandex.png",
  elo: "elo.png",
  qiwi: "qiwi.png",
  bitpay: "bitpay.png",
  "direct debit": "directdebit.png",
  directdebit: "directdebit.png",
  poli: "poli.png",
  webmoney: "webmoney.png",
  verifone: "verifone.png",
  "shop pay": "shoppay.png",
  shoppay: "shoppay.png",
  "facebook pay": "facebookpay.png",
  citadele: "citadele.png",
};

// Domain references: https://www.tbb.org.tr/banka-ve-sektor-bilgileri/banka-bilgileri/bankalar/internet-adresleri
const BANKS: { aliases: string[]; domain: string; bundled?: string }[] = [
  { aliases: ["enpara"], domain: "enpara.com", bundled: "enpara" },
  { aliases: ["denizbank", "deniz bank"], domain: "denizbank.com", bundled: "denizbank" },
  { aliases: ["garanti", "garantibbva"], domain: "garantibbva.com.tr", bundled: "garanti" },
  { aliases: ["ziraat dinamik"], domain: "ziraatdinamik.com.tr" },
  { aliases: ["ziraat katilim", "ziraatkatilim"], domain: "ziraatkatilim.com.tr" },
  { aliases: ["ziraat", "ziraatbank"], domain: "ziraatbank.com.tr" },
  { aliases: ["vakif katilim", "vakifkatilim"], domain: "vakifkatilim.com.tr" },
  { aliases: ["vakifbank", "vakif bank", "vakiflar bankasi"], domain: "vakifbank.com.tr" },
  { aliases: ["halkbank", "halk bank", "halk bankasi"], domain: "halkbank.com.tr" },
  { aliases: ["is bankasi", "is bank", "isbankasi", "isbank"], domain: "isbank.com.tr" },
  { aliases: ["yapi kredi", "yapikredi", "yapi ve kredi"], domain: "yapikredi.com.tr" },
  { aliases: ["akbank"], domain: "akbank.com" },
  { aliases: ["qnb", "finansbank"], domain: "qnb.com.tr" },
  { aliases: ["teb", "turk ekonomi bankasi", "cepteteb"], domain: "teb.com.tr" },
  { aliases: ["ing", "ingbank"], domain: "ing.com.tr" },
  { aliases: ["hsbc"], domain: "hsbc.com.tr" },
  { aliases: ["sekerbank", "seker bank"], domain: "sekerbank.com.tr" },
  { aliases: ["fibabanka", "fiba banka"], domain: "fibabanka.com.tr" },
  { aliases: ["odeabank", "odea bank"], domain: "odeabank.com.tr" },
  { aliases: ["burgan", "on dijital"], domain: "burgan.com.tr" },
  { aliases: ["alternatifbank", "alternatif bank", "abank"], domain: "alternatifbank.com.tr" },
  { aliases: ["anadolubank", "anadolu bank"], domain: "anadolubank.com.tr" },
  { aliases: ["aktifbank", "aktif bank", "nkolay", "n kolay"], domain: "aktifbank.com.tr" },
  { aliases: ["icbc"], domain: "icbc.com.tr" },
  { aliases: ["turkishbank", "turkish bank"], domain: "turkishbank.com" },
  { aliases: ["turkland", "tbank", "t bank"], domain: "tbank.com.tr" },
  { aliases: ["citibank", "citi bank"], domain: "citibank.com.tr" },
  { aliases: ["arap turk", "atbank"], domain: "atbank.com.tr" },
  { aliases: ["deutsche"], domain: "db.com.tr" },
  { aliases: ["bankpozitif", "bank pozitif"], domain: "bankpozitif.com.tr" },
  { aliases: ["colendi"], domain: "colendibank.com" },
  { aliases: ["fups"], domain: "fupsbank.com" },
  { aliases: ["turk ticaret", "turkticaret"], domain: "turkticaretbankasi.com.tr" },
  { aliases: ["albaraka"], domain: "albaraka.com.tr" },
  { aliases: ["kuveyt turk", "kuveytturk"], domain: "kuveytturk.com.tr" },
  { aliases: ["turkiye finans", "turkiyefinans"], domain: "turkiyefinans.com.tr" },
  { aliases: ["emlak katilim", "emlakkatilim"], domain: "emlakkatilim.com.tr" },
];

function normalize(name: string) {
  return name
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function paymentMethodLogoSources(method: PaymentMethod): string[] {
  const uploaded = method.icon ? paymentMethodsService.iconUrl(method) : null;
  if (uploaded) return [uploaded];
  const name = normalize(method.name);
  const bank = BANKS.find((entry) =>
    entry.aliases.some((alias) => (" " + name + " ").includes(" " + alias + " ")),
  );
  if (bank)
    return [
      ...(bank.bundled ? ["/assets/logos/banks/" + bank.bundled + ".svg"] : []),
      "https://icon.horse/icon/" + bank.domain,
      "https://icons.duckduckgo.com/ip3/" + bank.domain + ".ico",
    ];
  const icon = PAYMENT_ICON_MAP[method.name.trim().toLowerCase()];
  return icon ? ["/assets/payments/" + icon] : [];
}
