const { BadRequestError } = require("../../errors.cjs");

function requireSubscriptionCategory(app, record) {
  const id = record.getString("category");
  let category;
  if (id) {
    try {
      category = app.findRecordById("categories", id);
    } catch (_) {}
  }
  if (!category || category.getString("user") !== record.getString("user"))
    throw new BadRequestError("category_required", {
      category: { message: "category_required" },
    });
}

function requireUnusedCategory(app, category) {
  if (
    app.findRecordsByFilter("subscriptions", "category = {:id}", "", 1, 0, {
      id: category.id,
    }).length
  )
    throw new BadRequestError("category_in_use");
}

module.exports = { requireSubscriptionCategory, requireUnusedCategory };
