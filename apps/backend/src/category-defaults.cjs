const DEFAULT_CATEGORIES = [
  "AI",
  "Shopping",
  "Cloud Storage",
  "Communication",
  "Education",
  "Entertainment",
  "Gaming",
  "Health",
  "Insurance",
  "Music",
  "News",
  "Other",
  "Transportation",
  "Video",
];
// Expand existing accounts once. A later deletion remains a user choice.
const ADDED_DEFAULT_CATEGORIES = [
  {
    "key": "entertainment",
    "name": "Entertainment",
    "aliases": [
      "Amusement",
      "Divertissement",
      "Entertainment",
      "Entretenimento",
      "Entretenimiento",
      "Eğlence",
      "Intrattenimento",
      "Rozrywka",
      "Szórakozás",
      "Underholdning",
      "Unterhaltung",
      "Zábava",
      "Развлечения",
      "Розваги",
      "エンターテインメント",
      "娱乐",
      "엔터테인먼트"
    ]
  },
  {
    "key": "transportation",
    "name": "Transportation",
    "aliases": [
      "Doprava",
      "Mobilität",
      "Szállítás",
      "Transport",
      "Transportation",
      "Transporte",
      "Trasporti",
      "Ulaşım",
      "Vervoer",
      "Транспорт",
      "交通",
      "교통"
    ]
  },
  {
    "key": "insurance",
    "name": "Insurance",
    "aliases": [
      "Assicurazioni",
      "Assurances",
      "Biztosítás",
      "Forsikring",
      "Insurance",
      "Pojištění",
      "Seguros",
      "Sigorta",
      "Ubezpieczenia",
      "Versicherungen",
      "Verzekeringen",
      "Застраховки",
      "Страхование",
      "Страхування",
      "保险",
      "保険",
      "보험"
    ]
  }
];
const EXPANSION_KEY = "default_categories_expansion_v1";
const normalizedCategoryName = (name) => String(name || "").normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().trim();

function addMissingDefaultCategories(connection) {
  connection.exec("SAVEPOINT monline_default_categories");
  try {
    if (connection.prepare("SELECT value FROM monline_meta WHERE key = ?").get(EXPANSION_KEY)) {
      connection.exec("RELEASE SAVEPOINT monline_default_categories");
      return 0;
    }
    let added = 0;
    const insert = connection.prepare('INSERT INTO categories (id, name, "order", user, translation_key) VALUES (?, ?, ?, ?, ?)');
    for (const user of connection.prepare("SELECT id FROM users").all()) {
      const categories = connection.prepare('SELECT name, translation_key, "order" FROM categories WHERE user = ?').all(user.id);
      let order = categories.reduce((max, category) => Math.max(max, Number(category.order) || 0), -1) + 1;
      for (const category of ADDED_DEFAULT_CATEGORIES) {
        const aliases = new Set(category.aliases.map(normalizedCategoryName));
        if (categories.some((existing) => existing.translation_key === category.key || aliases.has(normalizedCategoryName(existing.name)))) continue;
        const id = require("node:crypto").randomBytes(16).toString("hex").slice(0, 15);
        insert.run(id, category.name, order++, user.id, category.key);
        added++;
      }
    }
    connection.prepare("INSERT INTO monline_meta (key, value) VALUES (?, ?)").run(EXPANSION_KEY, "done");
    connection.exec("RELEASE SAVEPOINT monline_default_categories");
    return added;
  } catch (error) {
    connection.exec("ROLLBACK TO SAVEPOINT monline_default_categories; RELEASE SAVEPOINT monline_default_categories");
    throw error;
  }
}
module.exports = { DEFAULT_CATEGORIES, addMissingDefaultCategories };
