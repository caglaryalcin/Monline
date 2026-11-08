const { NotFoundError } = require("../../errors.cjs");

function setMainCurrency(app, owner, id) {
  return app.runInTransaction((tx) => {
    const currencies = tx.findRecordsByFilter(
      "currencies",
      "user = {:owner}",
      "",
      0,
      0,
      { owner },
    );
    const selected = currencies.find((currency) => currency.id === id);
    if (!selected) throw new NotFoundError();
    const positive = (value) =>
      Number.isFinite(value) && value > 0 ? value : 0;
    const baseRate = positive(selected.get("rate"));
    for (const currency of currencies) {
      currency.set("is_main", currency.id === id);
      currency.set(
        "rate",
        currency.id === id
          ? 1
          : baseRate
            ? positive(currency.get("rate") / baseRate)
            : 0,
      );
      tx.save(currency);
    }
    const account = tx.findRecordById("users", owner);
    account.set("main_currency", id);
    tx.save(account);
    return { success: true, main_currency_id: id };
  });
}
module.exports = { setMainCurrency };
