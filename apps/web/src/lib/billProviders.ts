import { BILL_PROVIDER_LOGOS } from "./billProviderLogos";
import { NATIONAL_BILL_PROVIDERS } from "./billProvidersNational";

export const BILL_PROVIDER_GROUPS = ["electricity_retail", "electricity_distribution", "water", "gas", "communication"] as const;
export type BillProviderGroup = typeof BILL_PROVIDER_GROUPS[number];
export interface BillProvider {
  id: string;
  name: string;
  domain: string;
  group: BillProviderGroup;
  regions: string[];
  aliases: string[];
  logoFile?: string;
}
const provider = (id: string, name: string, domain: string, group: BillProviderGroup, regions: string[], aliases: string[] = []): BillProvider =>
  ({ id, name, domain, group, regions, aliases, logoFile: BILL_PROVIDER_LOGOS[domain] });

// Regional electricity coverage: ELDER's member directory. Retail and
// distribution are separate choices; these describe logos, not payment rules.
const BASE_BILL_PROVIDERS: BillProvider[] = [
  provider("trepas", "TREPAŞ", "trepas.com.tr", "electricity_retail", ["Edirne", "Kırklareli", "Tekirdağ"], ["Trakya Elektrik Perakende", "Trakya EPSAŞ"]),
  provider("ckbogazici", "CK Boğaziçi Elektrik", "ckbogazici.com.tr", "electricity_retail", ["İstanbul Avrupa Yakası"], ["CK Boğaziçi", "CK Enerji Boğaziçi"]),
  provider("ckakdeniz", "CK Akdeniz Elektrik", "ckakdeniz.com.tr", "electricity_retail", ["Antalya", "Burdur", "Isparta"], ["CK Akdeniz", "CK Enerji Akdeniz"]),
  provider("ckcamlibel", "CK Çamlıbel Elektrik", "ckcamlibel.com.tr", "electricity_retail", ["Sivas", "Tokat", "Yozgat"], ["CK Çamlıbel", "CK Enerji Çamlıbel"]),
  provider("enerjisa", "Enerjisa Elektrik", "enerjisa.com.tr", "electricity_retail", ["İstanbul Anadolu Yakası", "Ankara", "Bartın", "Çankırı", "Karabük", "Kastamonu", "Kırıkkale", "Zonguldak", "Adana", "Gaziantep", "Hatay", "Kilis", "Mersin", "Osmaniye"], ["Enerjisa", "Enerjisa Başkent", "Enerjisa Toroslar", "Enerjisa AYESAŞ"]),
  provider("aydemperakende", "Aydem Perakende", "aydemperakende.com.tr", "electricity_retail", ["Aydın", "Denizli", "Muğla"], ["Aydem Elektrik Perakende"]),
  provider("gedizperakende", "Gediz Perakende", "gedizperakende.com.tr", "electricity_retail", ["İzmir", "Manisa"], ["Gediz Elektrik Perakende", "Gediz EPSAŞ"]),
  provider("uludagelektrik", "Uludağ Elektrik", "uludagelektrik.com.tr", "electricity_retail", ["Balıkesir", "Bursa", "Çanakkale", "Yalova"], ["Uludağ Perakende", "Limak Uludağ", "UEPSAŞ"]),
  provider("sepas", "SEPAŞ Enerji", "sepas.com.tr", "electricity_retail", ["Bolu", "Düzce", "Kocaeli", "Sakarya"], ["SEPAŞ", "Sakarya Elektrik Perakende"]),

  provider("tredas", "TREDAŞ", "tredas.com.tr", "electricity_distribution", ["Edirne", "Kırklareli", "Tekirdağ"], ["Trakya Elektrik Dağıtım"]),
  provider("bedas", "BEDAŞ", "bedas.com.tr", "electricity_distribution", ["İstanbul Avrupa Yakası"], ["Boğaziçi Elektrik Dağıtım"]),
  provider("ayedas", "AYEDAŞ", "ayedas.com.tr", "electricity_distribution", ["İstanbul Anadolu Yakası"], ["Anadolu Yakası Elektrik Dağıtım"]),
  provider("baskentedas", "Başkent EDAŞ", "baskentedas.com.tr", "electricity_distribution", ["Ankara", "Bartın", "Çankırı", "Karabük", "Kastamonu", "Kırıkkale", "Zonguldak"], ["Başkent Elektrik Dağıtım"]),
  provider("toroslaredas", "Toroslar EDAŞ", "toroslaredas.com.tr", "electricity_distribution", ["Adana", "Gaziantep", "Hatay", "Kilis", "Mersin", "Osmaniye"], ["Toroslar Elektrik Dağıtım"]),
  provider("adm", "ADM Elektrik Dağıtım", "admelektrik.com.tr", "electricity_distribution", ["Aydın", "Denizli", "Muğla"], ["ADM EDAŞ", "ADM Elektrik"]),
  provider("akdenizedas", "Akdeniz EDAŞ", "akdenizedas.com.tr", "electricity_distribution", ["Antalya", "Burdur", "Isparta"], ["Akdeniz Elektrik Dağıtım"]),
  provider("akedasdagitim", "AKEDAŞ Dağıtım", "akedasdagitim.com.tr", "electricity_distribution", ["Adıyaman", "Kahramanmaraş"], ["AKEDAŞ Elektrik Dağıtım"]),
  provider("arasedas", "Aras EDAŞ", "arasedas.com", "electricity_distribution", ["Ağrı", "Ardahan", "Bayburt", "Erzincan", "Erzurum", "Iğdır", "Kars"], ["Aras Elektrik Dağıtım"]),
  provider("cedas", "ÇEDAŞ", "cedas.com.tr", "electricity_distribution", ["Sivas", "Tokat", "Yozgat"], ["Çamlıbel EDAŞ", "Çamlıbel Elektrik Dağıtım"]),
  provider("coruhedas", "Çoruh EDAŞ", "coruhedas.com.tr", "electricity_distribution", ["Artvin", "Giresun", "Gümüşhane", "Rize", "Trabzon"], ["Çoruh Elektrik Dağıtım"]),
  provider("dedas", "Dicle Elektrik Dağıtım", "dedas.com.tr", "electricity_distribution", ["Batman", "Diyarbakır", "Mardin", "Siirt", "Şanlıurfa", "Şırnak"], ["DEDAŞ", "Dicle EDAŞ"]),
  provider("firatedas", "Fırat EDAŞ", "firatedas.com.tr", "electricity_distribution", ["Bingöl", "Elazığ", "Malatya", "Tunceli"], ["Fırat Elektrik Dağıtım"]),
  provider("gdzelektrik", "GDZ Elektrik Dağıtım", "gdzelektrik.com.tr", "electricity_distribution", ["İzmir", "Manisa"], ["GDZ Elektrik", "Gediz Elektrik Dağıtım"]),
  provider("kcetas", "KCETAŞ", "kcetas.com.tr", "electricity_distribution", ["Kayseri"], ["Kayseri ve Civarı Elektrik"]),
  provider("medas", "MEDAŞ", "meramedas.com.tr", "electricity_distribution", ["Aksaray", "Karaman", "Kırşehir", "Konya", "Nevşehir", "Niğde"], ["Meram EDAŞ", "Meram Elektrik Dağıtım"]),
  provider("oedas", "OEDAŞ", "osmangaziedas.com.tr", "electricity_distribution", ["Afyonkarahisar", "Bilecik", "Eskişehir", "Kütahya", "Uşak"], ["Osmangazi EDAŞ", "Osmangazi Elektrik Dağıtım"]),
  provider("sedas", "SEDAŞ", "sedas.com", "electricity_distribution", ["Bolu", "Düzce", "Kocaeli", "Sakarya"], ["Sakarya Elektrik Dağıtım"]),
  provider("uedas", "UEDAŞ", "uedas.com.tr", "electricity_distribution", ["Balıkesir", "Bursa", "Çanakkale", "Yalova"], ["Uludağ EDAŞ", "Uludağ Elektrik Dağıtım"]),
  provider("vedas", "VEDAŞ", "vedas.com.tr", "electricity_distribution", ["Bitlis", "Hakkari", "Muş", "Van"], ["Vangölü EDAŞ", "Vangölü Elektrik Dağıtım"]),
  provider("yedas", "YEDAŞ", "yedas.com", "electricity_distribution", ["Amasya", "Çorum", "Ordu", "Samsun", "Sinop"], ["Yeşilırmak EDAŞ", "Yeşilırmak Elektrik Dağıtım"]),

  provider("iski", "İSKİ", "iski.istanbul", "water", ["İstanbul"], ["İstanbul Su ve Kanalizasyon"]),
  provider("askiankara", "ASKİ Ankara", "aski.gov.tr", "water", ["Ankara"], ["Ankara ASKİ", "Ankara Su ve Kanalizasyon"]),
  provider("askiadana", "ASKİ Adana", "adana-aski.gov.tr", "water", ["Adana"], ["Adana ASKİ", "Adana Su ve Kanalizasyon"]),
  provider("izsu", "İZSU", "izsu.gov.tr", "water", ["İzmir"], ["İzmir Su ve Kanalizasyon"]),
  provider("buski", "BUSKİ", "buski.gov.tr", "water", ["Bursa"], ["Bursa Su ve Kanalizasyon"]),
  provider("asat", "ASAT", "asat.gov.tr", "water", ["Antalya"], ["Antalya Su ve Atıksu"]),
  provider("koski", "KOSKİ", "koski.gov.tr", "water", ["Konya"], ["Konya Su ve Kanalizasyon"]),
  provider("edirnesu", "Edirne Belediyesi (Su)", "edirne.bel.tr", "water", ["Edirne"], ["Edirne Belediyesi", "Edirne Su"]),

  provider("igdas", "İGDAŞ", "igdas.istanbul", "gas", ["İstanbul"], ["İstanbul Gaz Dağıtım"]),
  provider("baskentgaz", "Başkentgaz", "baskentdogalgaz.com.tr", "gas", ["Ankara"], ["Başkent Gaz", "Başkent Doğalgaz"]),
  provider("izmirgaz", "İzmirgaz", "izmirgaz.com.tr", "gas", ["İzmir"], ["İzmir Gaz"]),
  provider("bursagaz", "Bursagaz", "bursagaz.com", "gas", ["Bursa"], ["Bursa Gaz"]),
  provider("izgaz", "İZGAZ", "izgaz.com.tr", "gas", ["Kocaeli"], ["İzmit Gaz"]),
  provider("enerya", "Enerya", "enerya.com.tr", "gas", [], ["Enerya Doğalgaz"]),
  provider("aksadogalgaz", "Aksa Doğalgaz", "aksadogalgaz.com.tr", "gas", [], ["Aksa Doğal Gaz"]),

  provider("turkcell", "Turkcell", "turkcell.com.tr", "communication", []),
  provider("turktelekom", "Türk Telekom", "turktelekom.com.tr", "communication", [], ["Türktelekom"]),
  provider("turknet", "TurkNet", "turk.net", "communication", [], ["Türk Net"]),
  provider("superonline", "Superonline", "superonline.net", "communication", [], ["Turkcell Superonline"]),
  provider("vodafone", "Vodafone", "vodafone.com.tr", "communication", []),
];

// Keep saved familiar provider names/domains while adding the official
// institution list and province associations. No account data is rewritten.
const providersById = new Map(BASE_BILL_PROVIDERS.map((entry) => [entry.id, entry]));
for (const entry of NATIONAL_BILL_PROVIDERS) {
  const existing = providersById.get(entry.id);
  const domain = existing?.domain || entry.domain;
  providersById.set(entry.id, {
    ...entry,
    name: existing?.name || entry.name,
    domain,
    regions: existing?.group === "electricity_retail" ? existing.regions : entry.regions,
    aliases: [...new Set([...(existing?.aliases || []), ...entry.aliases])],
    // Legacy provider logos already come from this same selected domain.
    logoFile: BILL_PROVIDER_LOGOS[domain] || entry.logoFile,
  });
}
export const BILL_PROVIDER_CATALOG: BillProvider[] = [...providersById.values()];

export function providerSearchText(value: string) {
  return value.normalize("NFKD").toLowerCase().replace(/ı/g, "i").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
const providerKey = (value: string) => providerSearchText(value).replace(/ /g, "");
const providerAliases = BILL_PROVIDER_CATALOG.flatMap((entry) => [entry.name, ...entry.aliases].map((alias) => ({
  provider: entry, alias: providerSearchText(alias),
}))).sort((a, b) => b.alias.length - a.alias.length);

export function findBillProvider(value: string) {
  const exact = providerKey(value.replace(/^www\./i, ""));
  const provider = BILL_PROVIDER_CATALOG.find((entry) => providerKey(entry.domain) === exact ||
    [entry.name, ...entry.aliases].some((alias) => providerKey(alias) === exact));
  if (provider) return provider;
  const words = ` ${providerSearchText(value)} `;
  // City names and generic labels such as "Elektrik" or "Su" are never logo matches.
  return providerAliases.find((entry) => words.includes(` ${entry.alias} `))?.provider;
}
