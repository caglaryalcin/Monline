// Merchant rules adapted from the user-provided finance_parser.py.
// A spending category does not confirm that a purchase is a recurring subscription.
export const STATEMENT_CATEGORIES = [
  "digital",
  "online",
  "bills",
  "shopping",
  "health",
  "groceries",
  "dining",
  "coffee",
  "travel",
  "transport",
  "toys",
  "foreign",
  "other",
  "fees",
] as const;
export type StatementCategory = (typeof STATEMENT_CATEGORIES)[number];
export const normalizeMerchant = (value: string) =>
  value
    .replace(/ı/g, "i")
    .replace(/İ/g, "I")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const rules: Record<string, { value: string; regex: boolean }[]> = {
  foreign: [
    {
      value: "yurt disi",
      regex: false,
    },
    {
      value: "yurtdisi",
      regex: false,
    },
  ],
  coffee: [
    {
      value: "aroasting",
      regex: false,
    },
    {
      value: "sespresso",
      regex: false,
    },
    {
      value: "soil coffee",
      regex: false,
    },
    {
      value: "starbucks",
      regex: false,
    },
    {
      value: "shady coffee",
      regex: false,
    },
    {
      value: "fam coffee",
      regex: false,
    },
    {
      value: "null coffee",
      regex: false,
    },
    {
      value: "kahve dunyasi",
      regex: false,
    },
    {
      value: "coffeemania",
      regex: false,
    },
    {
      value: "\\bcoffee\\b",
      regex: true,
    },
    {
      value: "\\bpiano\\b",
      regex: true,
    },
    {
      value: "gloria jean",
      regex: false,
    },
    {
      value: "caribou",
      regex: false,
    },
    {
      value: "petra roast",
      regex: false,
    },
    {
      value: "mandabatmaz",
      regex: false,
    },
    {
      value: "costa",
      regex: false,
    },
    {
      value: "caffe nero",
      regex: false,
    },
    {
      value: "tim horton",
      regex: false,
    },
    {
      value: "\\bbrew\\b",
      regex: true,
    },
    {
      value: "\\bkahve",
      regex: true,
    },
    {
      value: "\\bsbx\\b",
      regex: true,
    },
    {
      value: "\\bsbux\\b",
      regex: true,
    },
    {
      value: "espressolab",
      regex: false,
    },
    {
      value: "espresso lab",
      regex: false,
    },
  ],
  dining: [
    {
      value: "midpoint",
      regex: false,
    },
    {
      value: "pierreloti",
      regex: false,
    },
    {
      value: "gunaydin",
      regex: false,
    },
    {
      value: "oses",
      regex: false,
    },
    {
      value: "cigkofte",
      regex: false,
    },
    {
      value: "cig kofte",
      regex: false,
    },
    {
      value: "konyali",
      regex: false,
    },
    {
      value: "\\bkosk\\b",
      regex: true,
    },
    {
      value: "bartos",
      regex: false,
    },
    {
      value: "burger",
      regex: false,
    },
    {
      value: "prava",
      regex: false,
    },
    {
      value: "\\bpita\\b",
      regex: true,
    },
    {
      value: "pravaa",
      regex: false,
    },
    {
      value: "kavurmaci",
      regex: false,
    },
    {
      value: "steakho",
      regex: false,
    },
    {
      value: "kasaf",
      regex: false,
    },
    {
      value: "\\betli\\b",
      regex: true,
    },
    {
      value: "\\bkofte",
      regex: true,
    },
    {
      value: "doner",
      regex: false,
    },
    {
      value: "lokanta",
      regex: false,
    },
    {
      value: "restoran",
      regex: false,
    },
    {
      value: "pizza",
      regex: false,
    },
    {
      value: "\\blariba\\b",
      regex: true,
    },
    {
      value: "tacuk",
      regex: false,
    },
    {
      value: "torunlar",
      regex: false,
    },
    {
      value: "battal gazi",
      regex: false,
    },
    {
      value: "mcdonalds",
      regex: false,
    },
    {
      value: "mcdonald",
      regex: false,
    },
    {
      value: "\\bkfc\\b",
      regex: true,
    },
    {
      value: "burger king",
      regex: false,
    },
    {
      value: "pizza hut",
      regex: false,
    },
    {
      value: "dominos",
      regex: false,
    },
    {
      value: "little caesar",
      regex: false,
    },
    {
      value: "subway",
      regex: false,
    },
    {
      value: "popeyes",
      regex: false,
    },
    {
      value: "taco bell",
      regex: false,
    },
    {
      value: "five guys",
      regex: false,
    },
    {
      value: "yemeksepeti",
      regex: false,
    },
    {
      value: "trendyol yemek",
      regex: false,
    },
    {
      value: "fast food",
      regex: false,
    },
    {
      value: "kebap",
      regex: false,
    },
    {
      value: "kebab",
      regex: false,
    },
    {
      value: "mangal",
      regex: false,
    },
    {
      value: "ocakbasi",
      regex: false,
    },
    {
      value: "lahmacun",
      regex: false,
    },
    {
      value: "\\bpide\\b",
      regex: true,
    },
    {
      value: "\\bborek\\b",
      regex: true,
    },
    {
      value: "\\bbalik\\b",
      regex: true,
    },
    {
      value: "\\bfirin\\b",
      regex: true,
    },
    {
      value: "sushi",
      regex: false,
    },
    {
      value: "iskender",
      regex: false,
    },
    {
      value: "tantuni",
      regex: false,
    },
    {
      value: "bigchefs",
      regex: false,
    },
    {
      value: "carls jr",
      regex: false,
    },
    {
      value: "arby",
      regex: false,
    },
    {
      value: "tavuk dunyasi",
      regex: false,
    },
    {
      value: "muhallebici",
      regex: false,
    },
    {
      value: "happy moon",
      regex: false,
    },
    {
      value: "welldone",
      regex: false,
    },
    {
      value: "ranchero",
      regex: false,
    },
    {
      value: "eataly",
      regex: false,
    },
    {
      value: "morini",
      regex: false,
    },
    {
      value: "ramiz",
      regex: false,
    },
    {
      value: "\\bdurumle\\b",
      regex: true,
    },
    {
      value: "saray muhallebi",
      regex: false,
    },
    {
      value: "faruk gulluoglu",
      regex: false,
    },
    {
      value: "hafiz mustafa",
      regex: false,
    },
    {
      value: "sutcuogullari",
      regex: false,
    },
    {
      value: "\\btost\\b",
      regex: true,
    },
    {
      value: "gold stone",
      regex: false,
    },
    {
      value: "sekerci",
      regex: false,
    },
    {
      value: "magnolia",
      regex: false,
    },
    {
      value: "\\bkafe\\b",
      regex: true,
    },
  ],
  groceries: [
    {
      value: "getir",
      regex: false,
    },
    {
      value: "param\\s*/",
      regex: true,
    },
    {
      value: "migros",
      regex: false,
    },
    {
      value: "\\ba101\\b",
      regex: true,
    },
    {
      value: "\\bbim\\b",
      regex: true,
    },
    {
      value: "carrefour",
      regex: false,
    },
    {
      value: "demir gida",
      regex: false,
    },
    {
      value: "simit",
      regex: false,
    },
    {
      value: "pastane",
      regex: false,
    },
    {
      value: "kuruyemis",
      regex: false,
    },
    {
      value: "bozacisi",
      regex: false,
    },
    {
      value: "cikolata",
      regex: false,
    },
    {
      value: "kasap",
      regex: false,
    },
    {
      value: "kosk",
      regex: false,
    },
    {
      value: "konyali",
      regex: false,
    },
    {
      value: "gida",
      regex: false,
    },
    {
      value: "\\bet\\b",
      regex: true,
    },
    {
      value: "unlu mamul",
      regex: false,
    },
    {
      value: "\\bsok\\b",
      regex: true,
    },
    {
      value: "hakmar",
      regex: false,
    },
    {
      value: "makromarket",
      regex: false,
    },
    {
      value: "file market",
      regex: false,
    },
    {
      value: "\\bdia\\b",
      regex: true,
    },
    {
      value: "ekomini",
      regex: false,
    },
    {
      value: "tarım kredi",
      regex: false,
    },
    {
      value: "\\bmanav\\b",
      regex: true,
    },
    {
      value: "\\bbakkal\\b",
      regex: true,
    },
    {
      value: "sut market",
      regex: false,
    },
    {
      value: "fresh market",
      regex: false,
    },
    {
      value: "kose market",
      regex: false,
    },
    {
      value: "dora roma",
      regex: false,
    },
    {
      value: "kizilkayalar",
      regex: false,
    },
    {
      value: "\\bfile\\b",
      regex: true,
    },
    {
      value: "macrocenter",
      regex: false,
    },
  ],
  health: [
    {
      value: "eczane",
      regex: false,
    },
    {
      value: "eczanesi",
      regex: false,
    },
    {
      value: "hastane",
      regex: false,
    },
    {
      value: "hospital",
      regex: false,
    },
    {
      value: "klinik",
      regex: false,
    },
    {
      value: "universitesi tip",
      regex: false,
    },
    {
      value: "ozel gop",
      regex: false,
    },
    {
      value: "raim eczane",
      regex: false,
    },
    {
      value: "foca eczane",
      regex: false,
    },
    {
      value: "optik",
      regex: false,
    },
    {
      value: "\\bdis\\b",
      regex: true,
    },
    {
      value: "dental",
      regex: false,
    },
    {
      value: "\\bdoktor\\b",
      regex: true,
    },
    {
      value: "poliklinik",
      regex: false,
    },
    {
      value: "medikal",
      regex: false,
    },
    {
      value: "\\blab\\b",
      regex: true,
    },
    {
      value: "laboratuvar",
      regex: false,
    },
    {
      value: "saglik merkezi",
      regex: false,
    },
    {
      value: "rontgen",
      regex: false,
    },
    {
      value: "ultrason",
      regex: false,
    },
    {
      value: "\\bhekim\\b",
      regex: true,
    },
    {
      value: "dis klinigi",
      regex: false,
    },
    {
      value: "\\bdr\\b",
      regex: true,
    },
  ],
  digital: [
    {
      value: "claude",
      regex: false,
    },
    {
      value: "google",
      regex: false,
    },
    {
      value: "playstation",
      regex: false,
    },
    {
      value: "\\bpsn\\b",
      regex: true,
    },
    {
      value: "youtube",
      regex: false,
    },
    {
      value: "netflix",
      regex: false,
    },
    {
      value: "spotify",
      regex: false,
    },
    {
      value: "\\bapple\\b",
      regex: true,
    },
    {
      value: "microsoft",
      regex: false,
    },
    {
      value: "steam",
      regex: false,
    },
    {
      value: "twitch",
      regex: false,
    },
    {
      value: "amazonprime",
      regex: false,
    },
    {
      value: "amazon prime",
      regex: false,
    },
    {
      value: "disney",
      regex: false,
    },
    {
      value: "exxen",
      regex: false,
    },
    {
      value: "blutv",
      regex: false,
    },
    {
      value: "supercell",
      regex: false,
    },
    {
      value: "\\bbein\\b",
      regex: true,
    },
    {
      value: "deezer",
      regex: false,
    },
    {
      value: "canva",
      regex: false,
    },
    {
      value: "workspace",
      regex: false,
    },
    {
      value: "mubi",
      regex: false,
    },
    {
      value: "\\bgain\\b",
      regex: true,
    },
    {
      value: "\\btod\\b",
      regex: true,
    },
    {
      value: "ssport",
      regex: false,
    },
    {
      value: "fizy",
      regex: false,
    },
    {
      value: "muud",
      regex: false,
    },
    {
      value: "storytel",
      regex: false,
    },
    {
      value: "audible",
      regex: false,
    },
    {
      value: "linkedin",
      regex: false,
    },
    {
      value: "\\bzoom\\b",
      regex: true,
    },
    {
      value: "dropbox",
      regex: false,
    },
    {
      value: "adobe",
      regex: false,
    },
    {
      value: "chatgpt",
      regex: false,
    },
    {
      value: "midjourney",
      regex: false,
    },
    {
      value: "github",
      regex: false,
    },
    {
      value: "faceit",
      regex: false,
    },
    {
      value: "epicgames",
      regex: false,
    },
    {
      value: "epic games",
      regex: false,
    },
    {
      value: "roblox",
      regex: false,
    },
    {
      value: "nintendo",
      regex: false,
    },
    {
      value: "icloud",
      regex: false,
    },
    {
      value: "parametrix",
      regex: false,
    },
    {
      value: "hbomax.com",
      regex: false,
    },
    {
      value: "\\.ai\\b",
      regex: true,
    },
  ],
  online: [
    {
      value: "\\bamazon\\b",
      regex: true,
    },
    {
      value: "\\bamzn\\b",
      regex: true,
    },
    {
      value: "hepsiburada",
      regex: false,
    },
    {
      value: "hepsipay",
      regex: false,
    },
    {
      value: "n11",
      regex: false,
    },
    {
      value: "trendyol",
      regex: false,
    },
    {
      value: "aliexpress",
      regex: false,
    },
    {
      value: "ciceksepeti",
      regex: false,
    },
    {
      value: "gittigidiyor",
      regex: false,
    },
    {
      value: "iyzico",
      regex: false,
    },
    {
      value: "temu",
      regex: false,
    },
    {
      value: "shein",
      regex: false,
    },
    {
      value: "\\bebay\\b",
      regex: true,
    },
    {
      value: "reyonplus",
      regex: false,
    },
    {
      value: "sahibinden",
      regex: false,
    },
    {
      value: "sanal magaza",
      regex: false,
    },
    {
      value: "\\.(com|net)(\\.tr)?\\b",
      regex: true,
    },
    {
      value: "perakende",
      regex: false,
    },
  ],
  bills: [
    {
      value: "turkcell",
      regex: false,
    },
    {
      value: "turk telekom",
      regex: false,
    },
    {
      value: "ttnet",
      regex: false,
    },
    {
      value: "vodafone",
      regex: false,
    },
    {
      value: "elektrik",
      regex: false,
    },
    {
      value: "dogalgaz",
      regex: false,
    },
    {
      value: "igdas",
      regex: false,
    },
    {
      value: "\\biski\\b",
      regex: true,
    },
    {
      value: "internet",
      regex: false,
    },
    {
      value: "fiber",
      regex: false,
    },
    {
      value: "sigorta",
      regex: false,
    },
    {
      value: "aidat",
      regex: false,
    },
    {
      value: "danisim elektrik",
      regex: false,
    },
    {
      value: "ibb spor",
      regex: false,
    },
    {
      value: "istanbulkart",
      regex: false,
    },
    {
      value: "erbay reklam",
      regex: false,
    },
    {
      value: "paytr",
      regex: false,
    },
    {
      value: "\\bibb\\b",
      regex: true,
    },
    {
      value: "ck bogaz",
      regex: false,
    },
    {
      value: "bogazici",
      regex: false,
    },
    {
      value: "3dteknobiz",
      regex: false,
    },
    {
      value: "baskentgaz",
      regex: false,
    },
    {
      value: "enerjisa",
      regex: false,
    },
    {
      value: "toroslar",
      regex: false,
    },
    {
      value: "dicle elektrik",
      regex: false,
    },
    {
      value: "\\bptt\\b",
      regex: true,
    },
    {
      value: "yurtici kargo",
      regex: false,
    },
    {
      value: "mng kargo",
      regex: false,
    },
    {
      value: "aras kargo",
      regex: false,
    },
    {
      value: "\\bups\\b",
      regex: true,
    },
    {
      value: "\\bdhl\\b",
      regex: true,
    },
    {
      value: "fedex",
      regex: false,
    },
    {
      value: "\\bkargo\\b",
      regex: true,
    },
  ],
  travel: [
    {
      value: "\\bthy\\b",
      regex: true,
    },
    {
      value: "turkish airlines",
      regex: false,
    },
    {
      value: "pegasus",
      regex: false,
    },
    {
      value: "sunexpress",
      regex: false,
    },
    {
      value: "anadolujet",
      regex: false,
    },
    {
      value: "corendon",
      regex: false,
    },
    {
      value: "\\botel\\b",
      regex: true,
    },
    {
      value: "\\bhotel\\b",
      regex: true,
    },
    {
      value: "hostel",
      regex: false,
    },
    {
      value: "booking",
      regex: false,
    },
    {
      value: "airbnb",
      regex: false,
    },
    {
      value: "trivago",
      regex: false,
    },
    {
      value: "expedia",
      regex: false,
    },
    {
      value: "tatilsepeti",
      regex: false,
    },
    {
      value: "\\btur\\b",
      regex: true,
    },
    {
      value: "turoperator",
      regex: false,
    },
    {
      value: "otobus",
      regex: false,
    },
    {
      value: "\\bido\\b",
      regex: true,
    },
    {
      value: "turyol",
      regex: false,
    },
    {
      value: "\\bvapur\\b",
      regex: true,
    },
    {
      value: "ets tur",
      regex: false,
    },
    {
      value: "jolly tur",
      regex: false,
    },
  ],
  toys: [
    {
      value: "oyuncak",
      regex: false,
    },
    {
      value: "toyz",
      regex: false,
    },
    {
      value: "lego",
      regex: false,
    },
    {
      value: "jumbo",
      regex: false,
    },
  ],
  shopping: [
    {
      value: "lcw",
      regex: false,
    },
    {
      value: "jack jones",
      regex: false,
    },
    {
      value: "ikea",
      regex: false,
    },
    {
      value: "beymen",
      regex: false,
    },
    {
      value: "decathlon",
      regex: false,
    },
    {
      value: "koton",
      regex: false,
    },
    {
      value: "\\bmango\\b",
      regex: true,
    },
    {
      value: "\\bzara\\b",
      regex: true,
    },
    {
      value: "boyner",
      regex: false,
    },
    {
      value: "defacto",
      regex: false,
    },
    {
      value: "\\bh&m\\b",
      regex: true,
    },
    {
      value: "h and m",
      regex: false,
    },
    {
      value: "marks spencer",
      regex: false,
    },
    {
      value: "\\bmavi\\b",
      regex: true,
    },
    {
      value: "lacoste",
      regex: false,
    },
    {
      value: "\\bnike\\b",
      regex: true,
    },
    {
      value: "adidas",
      regex: false,
    },
    {
      value: "\\bpuma\\b",
      regex: true,
    },
    {
      value: "new balance",
      regex: false,
    },
    {
      value: "skechers",
      regex: false,
    },
    {
      value: "reserved",
      regex: false,
    },
    {
      value: "bershka",
      regex: false,
    },
    {
      value: "pull bear",
      regex: false,
    },
    {
      value: "stradivarius",
      regex: false,
    },
    {
      value: "massimo dutti",
      regex: false,
    },
    {
      value: "sarar",
      regex: false,
    },
    {
      value: "altinyildiz",
      regex: false,
    },
    {
      value: "\\bnetwork\\b",
      regex: true,
    },
    {
      value: "lefties",
      regex: false,
    },
    {
      value: "gratis",
      regex: false,
    },
    {
      value: "watsons",
      regex: false,
    },
    {
      value: "colins",
      regex: false,
    },
    {
      value: "columbia",
      regex: false,
    },
    {
      value: "converse",
      regex: false,
    },
    {
      value: "\\bgap\\b",
      regex: true,
    },
    {
      value: "levis",
      regex: false,
    },
    {
      value: "hummel",
      regex: false,
    },
    {
      value: "avva",
      regex: false,
    },
    {
      value: "ipekyol",
      regex: false,
    },
    {
      value: "kigili",
      regex: false,
    },
    {
      value: "jimmy key",
      regex: false,
    },
    {
      value: "\\bloft\\b",
      regex: true,
    },
    {
      value: "ltb",
      regex: false,
    },
    {
      value: "armine",
      regex: false,
    },
    {
      value: "damat",
      regex: false,
    },
    {
      value: "derimod",
      regex: false,
    },
    {
      value: "ecrou",
      regex: false,
    },
    {
      value: "hatemoglu",
      regex: false,
    },
    {
      value: "hotici",
      regex: false,
    },
    {
      value: "lufian",
      regex: false,
    },
    {
      value: "naramaxx",
      regex: false,
    },
    {
      value: "\\bflo\\b",
      regex: true,
    },
    {
      value: "deichmann",
      regex: false,
    },
    {
      value: "greyder",
      regex: false,
    },
    {
      value: "intersport",
      regex: false,
    },
    {
      value: "fenerium",
      regex: false,
    },
    {
      value: "gs store",
      regex: false,
    },
    {
      value: "media markt",
      regex: false,
    },
    {
      value: "arcelik",
      regex: false,
    },
    {
      value: "casper",
      regex: false,
    },
    {
      value: "\\bdyson\\b",
      regex: true,
    },
    {
      value: "\\blg\\b",
      regex: true,
    },
    {
      value: "bella maison",
      regex: false,
    },
    {
      value: "english home",
      regex: false,
    },
    {
      value: "enza home",
      regex: false,
    },
    {
      value: "karaca",
      regex: false,
    },
    {
      value: "madame coco",
      regex: false,
    },
    {
      value: "emsan",
      regex: false,
    },
    {
      value: "korkmaz",
      regex: false,
    },
    {
      value: "flormar",
      regex: false,
    },
    {
      value: "golden rose",
      regex: false,
    },
    {
      value: "kiko",
      regex: false,
    },
    {
      value: "lelas",
      regex: false,
    },
    {
      value: "cella",
      regex: false,
    },
    {
      value: "d&p parfum",
      regex: false,
    },
    {
      value: "flormar",
      regex: false,
    },
    {
      value: "chicco",
      regex: false,
    },
    {
      value: "ebebe",
      regex: false,
    },
    {
      value: "mamino",
      regex: false,
    },
    {
      value: "u.s polo",
      regex: false,
    },
    {
      value: "us polo",
      regex: false,
    },
  ],
  transport: [
    {
      value: "akaryakit",
      regex: false,
    },
    {
      value: "petrol",
      regex: false,
    },
    {
      value: "\\bshell\\b",
      regex: true,
    },
    {
      value: "\\bbp\\b",
      regex: true,
    },
    {
      value: "opet",
      regex: false,
    },
    {
      value: "\\btotal\\b",
      regex: true,
    },
    {
      value: "otopark",
      regex: false,
    },
    {
      value: "otoyol",
      regex: false,
    },
    {
      value: "\\bhgs\\b",
      regex: true,
    },
    {
      value: "\\bogs\\b",
      regex: true,
    },
    {
      value: "\\byss\\b",
      regex: true,
    },
    {
      value: "kopru gecis",
      regex: false,
    },
    {
      value: "motorlu tasit",
      regex: false,
    },
    {
      value: "\\bmtv\\b",
      regex: true,
    },
    {
      value: "\\bmetro\\b",
      regex: true,
    },
    {
      value: "taksi",
      regex: false,
    },
    {
      value: "\\buber\\b",
      regex: true,
    },
    {
      value: "bitaksi",
      regex: false,
    },
    {
      value: "marti",
      regex: false,
    },
    {
      value: "gopark",
      regex: false,
    },
    {
      value: "filo otomotiv",
      regex: false,
    },
    {
      value: "uzl filo",
      regex: false,
    },
    {
      value: "easypark",
      regex: false,
    },
    {
      value: "parkmatic",
      regex: false,
    },
    {
      value: "tuvturk",
      regex: false,
    },
    {
      value: "sabiha gokcen",
      regex: false,
    },
    {
      value: "\\bsaw\\b",
      regex: true,
    },
    {
      value: "\\botogar\\b",
      regex: true,
    },
    {
      value: "karayollari",
      regex: false,
    },
  ],
  fees: [
    {
      value: "nakit avans ucreti",
      regex: false,
    },
    {
      value: "faiz",
      regex: false,
    },
    {
      value: "kkdf",
      regex: false,
    },
    {
      value: "bsmv",
      regex: false,
    },
    {
      value: "komisyon",
      regex: false,
    },
    {
      value: "\\bvergi\\b",
      regex: true,
    },
    {
      value: "masraf",
      regex: false,
    },
    {
      value: "alisveris faizi",
      regex: false,
    },
  ],
};
const overrides: [string, StatementCategory][] = [
  ["pilpaketi", "online"],
  ["kanat", "dining"],
  ["beyzade", "dining"],
  ["kaspersky", "digital"],
  ["mng -", "bills"],
  ["inventus", "online"],
  ["bade natural", "online"],
  ["badenatural", "online"],
  ["aymerkez", "shopping"],
  ["avm", "shopping"],
  ["lalezar", "dining"],
  ["aydin ciger", "dining"],
  ["sicilia pub", "dining"],
  ["lounge", "dining"],
  ["pilav", "dining"],
  ["yeme", "dining"],
  ["icme", "dining"],
  ["pull&bear", "shopping"],
  ["market", "groceries"],
  ["aytemiz", "transport"],
];
const compiledRules = Object.fromEntries(
  Object.entries(rules).map(([category, entries]) => [
    category,
    entries.map((rule) => (rule.regex ? new RegExp(rule.value) : normalizeMerchant(rule.value))),
  ]),
);
export function statementCategory(merchant: string): StatementCategory {
  const text = normalizeMerchant(merchant);
  const override = overrides.find(([name]) =>
    name === "market" ? /\bmarket\b/.test(text) : text.includes(name),
  );
  if (override) return override[1];
  const matches = (category: string) =>
    compiledRules[category].some((rule) =>
      typeof rule === "string" ? text.includes(rule) : rule.test(text),
    );
  for (const category of ["digital", "online"] as const) if (matches(category)) return category;
  if (/\(\s*(?:[\d.,]+\s+[A-Z]{3}|[A-Z]{3}\s+[\d.,]+)\s*\)/.test(merchant)) return "foreign";
  for (const category of Object.keys(rules))
    if (category !== "digital" && category !== "online" && matches(category))
      return category as StatementCategory;
  return "other";
}
