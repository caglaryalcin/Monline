const { BadRequestError } = require("./errors.cjs");
const { subscriptionRecipients } = require("./sharing-notifications.cjs");
const { isPersonConfirmed } = require("./people-invitations.cjs");

function payerOptions(repository, subscription, viewerId) {
  const ownerId = subscription.getString("user");
  const people = repository.findRecordsByFilter(
    "household",
    "user = {:owner}",
    "name,id",
    0,
    0,
    { owner: ownerId },
  );
  const options = new Map();
  const confirmedPeople = people.filter((person) =>
    isPersonConfirmed(repository, person),
  );
  const addPerson = (person) =>
    options.set(person.id, {
      value: person.id,
      name: person.getString("name"),
    });
  if (viewerId === ownerId)
    for (const person of confirmedPeople) addPerson(person);
  const participants = subscriptionRecipients(repository, subscription);
  participants.add(ownerId);
  // Shared editors see consenting participants, without unrelated contact details.
  for (const person of confirmedPeople)
    if (participants.has(person.getString("account"))) addPerson(person);
  const current = confirmedPeople.find(
    (item) => item.id === subscription.getString("payer"),
  );
  if (current && !options.has(current.id)) addPerson(current);
  return [...options.values()];
}

function applyPayer(repository, subscription, value, viewerId) {
  if (typeof value !== "string")
    throw new BadRequestError("sharing_invalid_payer");
  if (!value) {
    subscription.set("payer", "");
    return;
  }
  // Keep a historical payer on unrelated edits, even after its account is unlinked.
  if (value === subscription.original().getString("payer")) {
    subscription.set("payer", value);
    return;
  }
  if (
    !payerOptions(repository, subscription, viewerId).some(
      (option) => option.value === value,
    )
  )
    throw new BadRequestError("sharing_invalid_payer");
  subscription.set("payer", value);
}

module.exports = { payerOptions, applyPayer };
