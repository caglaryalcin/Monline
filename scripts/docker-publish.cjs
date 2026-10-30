const fs = require("node:fs");
const { execFileSync, spawnSync } = require("node:child_process");
const { publicationPlan } = require("./publish-policy.cjs");

const version = JSON.parse(fs.readFileSync("package.json", "utf8")).version;
for (const file of ["apps/web/package.json", "apps/backend/package.json"]) {
  if (JSON.parse(fs.readFileSync(file, "utf8")).version !== version)
    throw new Error("Root, web and server package versions must match.");
}
const compose = fs.readFileSync("docker-compose.yml", "utf8");
if (
  !new RegExp(
    `^\\s+image:\\s+monline:${version.replaceAll(".", "\\.")}(?:\\s|$)`,
    "m",
  ).test(compose)
)
  throw new Error(
    "The local Compose image tag must match the package version.",
  );
const revision = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const isOn = (branch) =>
  spawnSync("git", [
    "merge-base",
    "--is-ancestor",
    "HEAD",
    `refs/remotes/origin/${branch}`,
  ]).status === 0;
const repository = process.env.GITHUB_REPOSITORY || "";
const plan = publicationPlan({
  repository,
  ref: process.env.GITHUB_REF || "",
  requestedVersion: process.env.VERSION || "",
  version,
  revision,
  onMain: isOn("main"),
  onBeta: isOn("beta"),
});
const images = [`ghcr.io/${repository.toLowerCase()}`, "caglaryalcin/monline"];
const tags = images.flatMap((image) =>
  plan.tags.map((tag) => `${image}:${tag}`),
);
const labels = [
  "org.opencontainers.image.title=Monline",
  "org.opencontainers.image.description=Self-hosted subscription and recurring payment tracking.",
  "org.opencontainers.image.licenses=GPL-3.0-only",
  `org.opencontainers.image.version=${version}`,
  `org.opencontainers.image.revision=${revision}`,
  `org.opencontainers.image.ref.name=${plan.channel}`,
];
fs.appendFileSync(
  process.env.GITHUB_OUTPUT,
  `image=${images[0]}\nchannel=${plan.channel}\ntags<<MONLINE_TAGS\n${tags.join("\n")}\nMONLINE_TAGS\nlabels<<MONLINE_LABELS\n${labels.join("\n")}\nMONLINE_LABELS\n`,
);
console.log(
  `Validated ${plan.channel} image publication: ${plan.tags.join(", ")}`,
);
