const { repository, security } = require("../../runtime.cjs");

const TOTP_LOGIN_CHALLENGE_TTL_MS = 5 * 60 * 1000;
function hashTotpLoginChallenge(challenge) {
  return security.sha256(String(challenge || ""));
}
function clearTotpLoginChallenge(user) {
  repository.connection
    .prepare(
      "DELETE FROM monline_sessions WHERE user_id=? AND purpose='totp_login'",
    )
    .run(user.id);
  user.set("totp_login_challenge_hash", "");
  user.set("totp_login_challenge_expires", "");
}
function createTotpLoginChallenge(user, remember = false) {
  const challenge = security.randomString(64);
  const expiresAt = new Date(
    Date.now() + TOTP_LOGIN_CHALLENGE_TTL_MS,
  ).toISOString();
  clearTotpLoginChallenge(user);
  repository.connection
    .prepare(
      "INSERT INTO monline_sessions (hash,user_id,expires,purpose,remember) VALUES (?,?,?,'totp_login',?)",
    )
    .run(
      hashTotpLoginChallenge(challenge),
      user.id,
      Date.parse(expiresAt),
      remember === true ? 1 : 0,
    );
  user.set("totp_login_challenge_hash", hashTotpLoginChallenge(challenge));
  user.set("totp_login_challenge_expires", expiresAt);
  repository.save(user);
  return {
    challenge,
    expiresAt,
  };
}
function findUserByTotpLoginChallenge(challenge) {
  const normalizedChallenge = String(challenge || "").trim();
  if (!normalizedChallenge) return null;
  const rows = repository.findRecordsByFilter(
    "users",
    "totp_login_challenge_hash = {:hash}",
    "",
    1,
    0,
    {
      hash: hashTotpLoginChallenge(normalizedChallenge),
    },
  );
  if (!rows || rows.length === 0) return null;
  const user = rows[0];
  const expiresAt = String(user.get("totp_login_challenge_expires") || "");
  if (!expiresAt || Date.parse(expiresAt) <= Date.now()) {
    clearTotpLoginChallenge(user);
    repository.save(user);
    return null;
  }
  return user;
}
function remembersSession(challenge, user) {
  return (
    repository.connection
      .prepare(
        "SELECT remember FROM monline_sessions WHERE hash=? AND user_id=? AND purpose='totp_login' AND expires>?",
      )
      .get(hashTotpLoginChallenge(challenge), user.id, Date.now())?.remember ===
    1
  );
}
module.exports = {
  TOTP_LOGIN_CHALLENGE_TTL_MS,
  hashTotpLoginChallenge,
  clearTotpLoginChallenge,
  createTotpLoginChallenge,
  findUserByTotpLoginChallenge,
  remembersSession,
};
