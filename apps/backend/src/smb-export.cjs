const { execFile } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

function failureCode(error, stdout, stderr) {
  if (error.code === "ENOENT") return { code: "spreadsheet_schedule_smb_unavailable" };
  const output = stdout + stderr;
  const marker = output.match(/MONLINE_SMB_ERROR:(\{[^\r\n]+\})/);
  let details;
  try { details = marker ? JSON.parse(marker[1]) : null; } catch {}
  const native = Number(details?.native);
  const stage = ["connect", "folder", "create", "upload", "replace"].includes(details?.stage)
    ? details.stage : undefined;
  let code = "spreadsheet_schedule_smb_failed";
  if (error.killed || error.code === "ETIMEDOUT") code = "spreadsheet_schedule_smb_timeout";
  else if (native === 1219) code = "spreadsheet_schedule_smb_session_conflict";
  else if ([86, 1326, 1330, 1331, 1909].includes(native) ||
      /NT_STATUS_(LOGON_FAILURE|WRONG_PASSWORD|ACCOUNT_DISABLED|PASSWORD_EXPIRED)/.test(output))
    code = "spreadsheet_schedule_smb_auth_failed";
  else if (native === 5 || /NT_STATUS_ACCESS_DENIED/.test(output))
    code = "spreadsheet_schedule_smb_permission";
  else if ([53, 64, 1231].includes(native) ||
      /NT_STATUS_(HOST_UNREACHABLE|NETWORK_UNREACHABLE|IO_TIMEOUT|CONNECTION_REFUSED)/.test(output))
    code = "spreadsheet_schedule_smb_network";
  else if (native === 67 || /NT_STATUS_BAD_NETWORK_NAME/.test(output))
    code = "spreadsheet_schedule_smb_share_missing";
  else if ([2, 3].includes(native) || details?.missingFolder ||
      /NT_STATUS_(OBJECT_PATH_NOT_FOUND|OBJECT_NAME_NOT_FOUND)/.test(output))
    code = "spreadsheet_schedule_smb_folder_missing";
  return { code, stage, native: Number.isInteger(native) ? native : undefined,
    ...(process.env.MONLINE_SMB_DIAGNOSTICS === "1" ? {
      type: details?.type, diagnostic: details?.diagnostic, errorId: details?.errorId,
    } : {}) };
}

function validateSmbConfig(value) {
  const segment = (text) => text && text !== "." && text !== ".." &&
    !/[\\/:*?"<>|;\x00-\x1f]/.test(text) && !/[. ]$/.test(text);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,252}$/.test(value.host) ||
      !segment(value.share) || value.share.length > 255 ||
      typeof value.username !== "string" || !value.username || value.username.length > 256 ||
      typeof value.domain !== "string" || value.domain.length > 256 ||
      /[\r\n\0]/.test(value.username + value.domain) ||
      typeof value.password !== "string" || !value.password || value.password.length > 4096 ||
      /[\r\n\0]/.test(value.password) || typeof value.folder !== "string" || value.folder.length > 1024)
    throw new Error("spreadsheet_schedule_smb_invalid");
  const parts = value.folder.replace(/\\/g, "/").split("/").filter(Boolean);
  if (!parts.every(segment)) throw new Error("spreadsheet_schedule_smb_invalid");
  return { ...value, folder: parts.join("/") };
}

function command(file, args, options = {}, input = "") {
  return new Promise((resolve, reject) => {
    const child = execFile(file, args, {
      windowsHide: true, timeout: 120000, maxBuffer: 512 * 1024, ...options,
    }, (error, stdout, stderr) => {
      if (!error) return resolve();
      if (options.allowExisting && /NT_STATUS_OBJECT_NAME_COLLISION/.test(stdout + stderr)) return resolve();
      const details = failureCode(error, stdout, stderr);
      // Child output can include server responses; never log or return it.
      reject(Object.assign(new Error(details.code), { smbDetails: details }));
    });
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
}

// Configuration and credentials arrive through stdin, never through shell
// interpolation or process arguments. A temporary PSDrive does not persist.
const WINDOWS_SCRIPT = [
  "[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)",
  "$ErrorActionPreference = 'Stop'",
  "$ProgressPreference = 'SilentlyContinue'",
  "$data = [Console]::In.ReadToEnd() | ConvertFrom-Json",
  "$stage = 'connect'",
  "$missingFolder = $false",
  "try {",
  "$secret = ConvertTo-SecureString -String $data.password -AsPlainText -Force",
  "$name = if ($data.domain) { $data.domain + '\\' + $data.username } else { $data.username }",
  "$credential = New-Object System.Management.Automation.PSCredential ($name, $secret)",
  "$root = '\\\\' + $data.host + '\\' + $data.share",
  "  New-PSDrive -Name MonlineExport -PSProvider FileSystem -Root $root -Credential $credential -Scope Script | Out-Null",
  "  $stage = 'folder'",
  "  $base = 'MonlineExport:\\'",
  "  if ($data.folder) { $base = Join-Path $base ($data.folder.Replace('/', '\\')) }",
  "  if (!(Test-Path -LiteralPath $base -PathType Container)) { $missingFolder = $true; throw 'Missing destination folder' }",
  "  if (!$data.probe) {",
  "    $directory = $base",
  "    $temporary = Join-Path $directory $data.temporary",
  "    $destination = Join-Path $directory 'Monline.xlsx'",
  "    try {",
  "      $stage = 'upload'",
  "      Copy-Item -LiteralPath $data.source -Destination $temporary",
  "      $stage = 'replace'",
  "      Move-Item -LiteralPath $temporary -Destination $destination -Force",
  "    } finally { if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force } }",
  "  } else { Get-Item -LiteralPath $base | Out-Null }",
  "} catch {",
  "  $exception = $_.Exception",
  "  while ($exception.InnerException) { $exception = $exception.InnerException }",
  "  $native = $exception.HResult -band 65535",
  "  if ($exception.PSObject.Properties['NativeErrorCode']) { $native = $exception.NativeErrorCode }",
  "  $message = $exception.Message",
  "  foreach ($key in @('password','username','domain','host','share','folder')) {",
  "    $sensitive = [string]$data.$key",
  "    if ($sensitive) { $message = $message.Replace($sensitive, '[redacted]') }",
  "  }",
  "  if ($message.Length -gt 400) { $message = $message.Substring(0,400) }",
  "  $details = @{stage=$stage; native=$native; missingFolder=$missingFolder; type=$exception.GetType().FullName; diagnostic=$message; errorId=$_.FullyQualifiedErrorId.Split(',')[0]} | ConvertTo-Json -Compress",
  "  [Console]::Error.WriteLine('MONLINE_SMB_ERROR:' + $details)",
  "  exit 2",
  "} finally { Remove-PSDrive -Name MonlineExport -ErrorAction SilentlyContinue }",
].join("\n");

async function withSmb(value, owner, bytes) {
  const config = validateSmbConfig(value), probe = bytes === undefined;
  if (!probe && !/^[a-zA-Z0-9_-]+$/.test(owner))
    throw new Error("spreadsheet_schedule_smb_invalid");
  const work = await fs.mkdtemp(path.join(os.tmpdir(), "monline-smb-"));
  await fs.chmod(work, 0o700);
  const source = path.join(work, "export.xlsx");
  const temporary = ".monline-" + crypto.randomUUID() + ".tmp";
  try {
    if (/[";\r\n\0]/.test(source)) throw new Error("spreadsheet_schedule_smb_failed");
    if (!probe) await fs.writeFile(source, bytes, { mode: 0o600 });
    if (process.platform === "win32") {
      const modules = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0");
      await command(path.join(modules, "powershell.exe"), ["-NoProfile", "-NonInteractive", "-Command", WINDOWS_SCRIPT],
        { env: { ...process.env, PSModulePath: path.join(modules, "Modules") } },
        JSON.stringify({ ...config, owner, source, temporary, probe }));
      return;
    }
    const credentials = path.join(work, "credentials");
    await fs.writeFile(credentials, "username = " + config.username + "\npassword = " + config.password +
      "\ndomain = " + config.domain + "\n", { mode: 0o600 });
    const args = ["//" + config.host + "/" + config.share, "-A", credentials, "-p", "445",
      "--option=client min protocol=SMB2", "--client-protection=sign", "--use-kerberos=off",
      "-t", "30", "-d", "0"];
    if (config.folder) args.push("-D", config.folder);
    if (probe) { await command("smbclient", [...args, "-c", "ls"]); return; }
    const remote = temporary;
    try {
      await command("smbclient", [...args, "-c", 'put "' + source + '" "' + remote + '"']);
      await command("smbclient", [...args, "-c", 'rename "' + remote + '" "Monline.xlsx" -f']);
    } finally {
      await command("smbclient", [...args, "-c", 'rm "' + remote + '"']).catch(() => {});
    }
  } finally {
    const resolved = path.resolve(work);
    if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith("monline-smb-"))
      await fs.rm(resolved, { recursive: true, force: true });
  }
}
module.exports = {
  failureCode,
  validateSmbConfig,
  writeSmb: (config, owner, bytes) => withSmb(config, owner, bytes),
  probeSmb: (config) => withSmb(config),
};
