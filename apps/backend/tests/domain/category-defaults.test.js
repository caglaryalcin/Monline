const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Repository, DataRecord } = require("../../src/storage.cjs");
const { addMissingDefaultCategories } = require("../../src/category-defaults.cjs");

it("adds defaults to existing accounts once, preserves localized custom categories and respects later deletion", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "monline-category-upgrade-"));
  let repository = new Repository(directory);
  try {
    const create = (collection, values) => {
      const record = new DataRecord(repository.findCollectionByNameOrId(collection));
      for (const [key,value] of Object.entries(values)) record.set(key,value);
      return repository.save(record);
    };
    const user = create("users", {email:"defaults@example.test",password:"fixture-hash"});
    const transport = create("categories", {user:user.id,name:"Ulaşım",color:"#123456",order:5});
    repository.connection.prepare("DELETE FROM monline_meta WHERE key = ?").run("default_categories_expansion_v1");
    repository.connection.close();
    repository = new Repository(directory);
    expect(repository.findRecordById("categories",transport.id).publicExport()).toMatchObject({name:"Ulaşım",color:"#123456",order:5});
    expect(repository.findRecordsByFilter("categories").map(row => row.getString("name")).sort())
      .toEqual(["Entertainment","Insurance","Ulaşım"]);
    const entertainment = repository.findRecordsByFilter("categories","translation_key = 'entertainment'")[0];
    repository.connection.prepare("DELETE FROM categories WHERE id = ?").run(entertainment.id);
    expect(addMissingDefaultCategories(repository.connection)).toBe(0);
    repository.connection.close(); repository = new Repository(directory);
    expect(repository.countRecords("categories")).toBe(2);
  } finally {
    repository.connection.close();
    expect(path.dirname(path.resolve(directory))).toBe(path.resolve(os.tmpdir()));
    expect(path.basename(directory)).toMatch(/^monline-category-upgrade-/);
    fs.rmSync(directory,{recursive:true,force:true});
  }
});
