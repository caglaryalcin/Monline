function normalizeSubscriptionName(name) {
  if (typeof name !== "string") return name;
  switch (name.trim().toLowerCase()) {
    case "faceit":
      return "Faceit";
    case "chatgpt":
      return "Chatgpt";
    default:
      return name;
  }
}

function normalizeStoredSubscriptionNames(repository) {
  repository.runInTransaction(() => {
    for (const subscription of repository.findRecordsByFilter(
      "subscriptions",
      "",
      "",
      0,
      0,
    )) {
      const name = subscription.getString("name");
      const normalized = normalizeSubscriptionName(name);
      if (name !== normalized) {
        subscription.set("name", normalized);
        repository.save(subscription);
      }
    }
  });
}

module.exports = {
  normalizeSubscriptionName,
  normalizeStoredSubscriptionNames,
};
