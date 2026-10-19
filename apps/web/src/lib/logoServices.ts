/** Shared by inline previews, saved subscription logos and the manual logo search.
 * These are visual name aliases only; they do not classify statement payments.
 */
interface LogoService {
  domain: string;
  iconSlug: string;
  logoUrl?: string;
}

// domain, pipe-separated names/aliases, optional Simple Icons slug and bundled logo
const SERVICES: [string, string, string?, string?][] = [
  // Hosting, cloud and developer tools
  ["vercel.com", "Vercel"],
  ["netlify.com", "Netlify"],
  ["cloudflare.com", "Cloudflare|Cloudflare Workers"],
  ["supabase.com", "Supabase"],
  ["firebase.google.com", "Firebase|Google Firebase", "firebase"],
  ["railway.com", "Railway"],
  ["render.com", "Render"],
  ["fly.io", "Fly.io|Fly", "flydotio"],
  ["heroku.com", "Heroku"],
  ["digitalocean.com", "DigitalOcean|Digital Ocean"],
  ["hetzner.com", "Hetzner|Hetzner Cloud"],
  ["linode.com", "Linode"],
  ["vultr.com", "Vultr"],
  ["ovhcloud.com", "OVH|OVHcloud", "ovh"],
  ["aws.amazon.com", "AWS|Amazon Web Services", "amazonwebservices"],
  ["azure.microsoft.com", "Azure|Microsoft Azure", "microsoftazure"],
  ["cloud.google.com", "Google Cloud|GCP", "googlecloud"],
  ["github.com", "GitHub|GitHub Copilot", "github"],
  ["gitlab.com", "GitLab"],
  ["bitbucket.org", "Bitbucket"],
  ["docker.com", "Docker|Docker Hub", "docker"],
  ["jetbrains.com", "JetBrains|IntelliJ IDEA|WebStorm|PyCharm|Rider", "jetbrains"],
  ["cursor.com", "Cursor"],
  ["windsurf.com", "Windsurf|Codeium", "windsurf"],
  ["replit.com", "Replit"],
  ["codepen.io", "CodePen"],
  ["codesandbox.io", "CodeSandbox"],
  ["postman.com", "Postman"],
  ["sentry.io", "Sentry"],
  ["datadoghq.com", "Datadog"],
  ["newrelic.com", "New Relic"],
  ["grafana.com", "Grafana|Grafana Cloud", "grafana"],
  ["mongodb.com", "MongoDB|MongoDB Atlas", "mongodb"],
  ["elastic.co", "Elastic|Elasticsearch", "elastic"],
  ["planetscale.com", "PlanetScale"],
  ["neon.tech", "Neon|Neon Database", "neon"],
  ["upstash.com", "Upstash"],
  ["resend.com", "Resend"],
  ["sendgrid.com", "SendGrid|Twilio SendGrid", "sendgrid"],
  ["mailgun.com", "Mailgun"],
  ["namecheap.com", "Namecheap"],
  ["godaddy.com", "GoDaddy"],
  ["hostinger.com", "Hostinger"],
  ["wordpress.com", "WordPress"],
  ["webflow.com", "Webflow"],
  ["framer.com", "Framer"],
  ["squarespace.com", "Squarespace"],
  ["wix.com", "Wix"],
  ["shopify.com", "Shopify"],
  // Browsers, privacy and security
  [
    "firefox.com",
    "Firefox|Firefox Browser|Mozilla Firefox|Firefox Nightly|Firefox Developer Edition",
    "firefoxbrowser",
  ],
  ["mozilla.org", "Mozilla|Mozilla VPN|Firefox Relay", "mozilla"],
  ["brave.com", "Brave|Brave Browser|Brave VPN", "brave"],
  ["opera.com", "Opera|Opera GX", "opera"],
  ["vivaldi.com", "Vivaldi"],
  ["1password.com", "1Password"],
  ["bitwarden.com", "Bitwarden"],
  ["lastpass.com", "LastPass"],
  ["dashlane.com", "Dashlane"],
  ["nordvpn.com", "NordVPN|Nord VPN", "nordvpn"],
  ["expressvpn.com", "ExpressVPN|Express VPN", "expressvpn"],
  ["surfshark.com", "Surfshark"],
  ["mullvad.net", "Mullvad|Mullvad VPN", "mullvad"],
  ["proton.me", "Proton|Proton Mail|Proton Drive|Proton Pass", "proton"],
  ["protonvpn.com", "Proton VPN|ProtonVPN", "protonvpn"],
  ["adguard.com", "AdGuard|AdGuard VPN", "adguard"],
  ["norton.com", "Norton|Norton 360", "norton"],
  ["malwarebytes.com", "Malwarebytes"],
  // Streaming, music and communities
  ["kick.com", "Kick"],
  ["twitch.tv", "Twitch|Twitch Turbo", "twitch"],
  [
    "youtube.com",
    "YouTube|YouTube Premium|YouTube Music|YouTube Member|YouTube Membership|YouTube Super|YouTube Superchat",
    "youtube",
  ],
  ["netflix.com", "Netflix"],
  ["spotify.com", "Spotify"],
  ["disneyplus.com", "Disney|Disney Plus|Disney+", "disneyplus"],
  ["primevideo.com", "Prime Video|Amazon Prime|Prime", "primevideo"],
  ["hbo.com", "HBO|HBO Max|Max|BluTV", "hbo"],
  ["paramountplus.com", "Paramount|Paramount Plus|Paramount+", "paramountplus"],
  ["hulu.com", "Hulu"],
  ["crunchyroll.com", "Crunchyroll"],
  ["mubi.com", "MUBI"],
  ["exxen.com", "Exxen"],
  ["gain.tv", "Gain|GAİN", "gain"],
  ["deezer.com", "Deezer"],
  ["tidal.com", "Tidal"],
  ["soundcloud.com", "SoundCloud|SoundCloud Go", "soundcloud"],
  ["audible.com", "Audible"],
  ["storytel.com", "Storytel"],
  ["discord.com", "Discord|Discord Nitro", "discord"],
  ["patreon.com", "Patreon"],
  ["substack.com", "Substack"],
  ["medium.com", "Medium"],
  // Google, Apple, Microsoft and storage
  ["google.com", "Google"],
  ["one.google.com", "Google One|Google Storage", "google"],
  ["drive.google.com", "Google Drive", "googledrive"],
  ["workspace.google.com", "Google Workspace|G Suite|GSuite", "google"],
  ["play.google.com", "Google Play|Google Play Pass", "googleplay"],
  ["apple.com", "Apple|Apple One", "apple"],
  ["music.apple.com", "Apple Music", "applemusic"],
  ["tv.apple.com", "Apple TV|Apple TV+", "appletv"],
  ["icloud.com", "iCloud|iCloud+|iCloud Plus", "icloud"],
  ["microsoft.com", "Microsoft|Microsoft 365|Office 365|MS 365", "microsoft"],
  ["onedrive.live.com", "OneDrive|Microsoft OneDrive", "microsoftonedrive"],
  ["dropbox.com", "Dropbox"],
  ["box.com", "Box"],
  ["pcloud.com", "pCloud"],
  ["mega.io", "MEGA", "mega"],
  ["sync.com", "Sync|Sync.com", "sync"],
  ["backblaze.com", "Backblaze"],
  ["idrive.com", "IDrive"],
  ["wetransfer.com", "WeTransfer"],
  // Design, productivity and communication
  [
    "adobe.com",
    "Adobe|Adobe Creative Cloud|Creative Cloud|Photoshop|Illustrator|Adobe Acrobat",
    "adobe",
  ],
  ["figma.com", "Figma|FigJam", "figma"],
  ["canva.com", "Canva"],
  ["sketch.com", "Sketch"],
  ["miro.com", "Miro"],
  ["notion.so", "Notion"],
  ["evernote.com", "Evernote"],
  ["obsidian.md", "Obsidian|Obsidian Sync|Obsidian Publish", "obsidian"],
  ["readwise.io", "Readwise|Readwise Reader", "readwise"],
  ["todoist.com", "Todoist"],
  ["ticktick.com", "TickTick"],
  ["linear.app", "Linear"],
  ["clickup.com", "ClickUp"],
  ["asana.com", "Asana"],
  ["trello.com", "Trello"],
  ["monday.com", "Monday|Monday.com", "mondaydotcom"],
  ["atlassian.com", "Atlassian|Jira|Confluence", "atlassian"],
  ["slack.com", "Slack"],
  ["zoom.us", "Zoom"],
  ["teams.microsoft.com", "Microsoft Teams|Teams", "microsoftteams"],
  ["loom.com", "Loom"],
  ["calendly.com", "Calendly"],
  ["airtable.com", "Airtable"],
  ["coda.io", "Coda"],
  ["zapier.com", "Zapier"],
  ["make.com", "Make|Integromat", "make"],
  ["ifttt.com", "IFTTT"],
  ["grammarly.com", "Grammarly"],
  ["deepl.com", "DeepL"],
  ["openai.com", "OpenAI|ChatGPT|Chat GPT", "openai"],
  ["claude.ai", "Claude|Anthropic Claude", "claude"],
  ["anthropic.com", "Anthropic"],
  ["perplexity.ai", "Perplexity", "perplexity"],
  ["midjourney.com", "Midjourney"],
  ["elevenlabs.io", "ElevenLabs", "elevenlabs"],
  ["runwayml.com", "Runway|RunwayML", "runway"],
  ["suno.com", "Suno"],
  // Games, education and other common memberships
  ["faceit.com", "FACEIT|FACEIT Premium|FACEIT Plus", "faceit", "/assets/logos/faceit.svg"],
  ["store.supercell.com", "Supercell Store|Supercell", "supercell"],
  ["steampowered.com", "Steam", "steam"],
  ["epicgames.com", "Epic|Epic Games|Fortnite Crew", "epicgames"],
  ["playstation.com", "PlayStation|PlayStation Plus|PS Plus|PSN", "playstation"],
  ["xbox.com", "Xbox|Xbox Game Pass|Game Pass", "xbox"],
  ["nintendo.com", "Nintendo|Nintendo Switch Online", "nintendo"],
  ["ea.com", "EA|EA Play|Electronic Arts", "ea"],
  ["ubisoft.com", "Ubisoft|Ubisoft+|Ubisoft Plus", "ubisoft"],
  ["nvidia.com", "NVIDIA|GeForce Now", "nvidia"],
  ["humblebundle.com", "Humble Bundle|Humble Choice", "humblebundle"],
  ["duolingo.com", "Duolingo|Super Duolingo", "duolingo"],
  ["coursera.org", "Coursera|Coursera Plus", "coursera"],
  ["udemy.com", "Udemy"],
  ["skillshare.com", "Skillshare"],
  ["linkedin.com", "LinkedIn|LinkedIn Premium", "linkedin"],
  ["strava.com", "Strava"],
  ["alltrails.com", "AllTrails"],
  ["fitbit.com", "Fitbit"],
  ["headspace.com", "Headspace"],
  ["calm.com", "Calm"],
  ["amazon.com", "Amazon|Amazon Music|Kindle Unlimited", "amazon"],
  ["x.com", "X|Twitter|Twitter Blue", "x"],
  ["instagram.com", "Instagram"],
  ["facebook.com", "Facebook"],
  ["nubank.com.br", "Nubank"],
];

export function normalizeLogoName(value: string): string {
  return value
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/\+/g, "plus")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

const byName = new Map<string, LogoService>();
for (const [domain, aliases, slug, logoUrl] of SERVICES) {
  const names = aliases.split("|");
  const service = { domain, iconSlug: slug ?? normalizeLogoName(names[0]), logoUrl };
  for (const name of [...names, domain, `www.${domain}`])
    byName.set(normalizeLogoName(name), service);
}

export function findLogoService(name: string): LogoService | undefined {
  const normalized = normalizeLogoName(name);
  const exact = byName.get(normalized);
  if (exact) return exact;
  // Match plan labels without guessing arbitrary company.com addresses or
  // matching part of a different company name (e.g. Kick vs Kickstarter).
  let candidate = normalized;
  for (let step = 0; step < 3; step++) {
    const withoutPlan = candidate.replace(
      /(?:premium|professional|pro|plus|business|personal|family|individual|student|ultimate|teams|team|enterprise|standard|advanced|starter|basic|hobby|duo|extra|essential|deluxe|monthly|yearly|annual|aylik|yillik|aboneligi|abonelik|subscription|uyelik)$/,
      "",
    );
    if (withoutPlan === candidate) return undefined;
    const match = byName.get(withoutPlan);
    if (match) return match;
    candidate = withoutPlan;
  }
  return undefined;
}
