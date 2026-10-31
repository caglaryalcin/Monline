import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "@/lib/toast";

import { SpreadsheetInfo } from "./SpreadsheetInfo";

interface IntegrationConfig {
  nas_directory: string;
  nas_mode: "directory" | "smb";
  smb_host: string;
  smb_share: string;
  smb_folder: string;
  smb_username: string;
  smb_domain: string;
  smb_password_configured: boolean;
  google_client_id: string;
  google_client_secret_configured: boolean;
  public_url: string;
  environment: {
    nas_directory: boolean;
    google_client_id: boolean;
    google_client_secret: boolean;
    public_url: boolean;
  };
}

function ConfigurationForm({ target, config, callbackUrl, onSaved, onClose }: {
  target: "nas" | "drive"; config: IntegrationConfig; callbackUrl: string;
  onSaved: () => Promise<void>; onClose: () => void;
}) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const [directory, setDirectory] = useState(config.nas_directory);
  const [nasMode, setNasMode] = useState<"directory" | "smb">(config.nas_mode);
  const [smbHost, setSmbHost] = useState(config.smb_host);
  const [smbShare, setSmbShare] = useState(config.smb_share);
  const [smbFolder, setSmbFolder] = useState(config.smb_folder);
  const [smbUser, setSmbUser] = useState(config.smb_username);
  const [smbDomain, setSmbDomain] = useState(config.smb_domain);
  const [smbPassword, setSmbPassword] = useState("");
  const [clientId, setClientId] = useState(config.google_client_id);
  const [secret, setSecret] = useState("");
  const [publicUrl, setPublicUrl] = useState(config.public_url);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const title = t("spreadsheet_schedule_" + target + "_config_title");
  let effectiveCallback = callbackUrl;
  try {
    const url = new URL(publicUrl);
    url.pathname = url.pathname.replace(/\/+$/, "") + "/api/spreadsheet-schedules/drive/callback";
    url.search = "";
    url.hash = "";
    effectiveCallback = url.href;
  } catch { effectiveCallback = ""; }
  async function save() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await api.put("/api/spreadsheet-integrations/" + target, target === "nas"
        ? { nas_mode: nasMode, nas_directory: directory, smb_host: smbHost, smb_share: smbShare,
          smb_folder: smbFolder, smb_username: smbUser, smb_domain: smbDomain, smb_password: smbPassword }
        : { google_client_id: clientId, google_client_secret: secret, public_url: publicUrl });
      setSecret("");
      setSmbPassword("");
      if (target === "drive") await cache.invalidateQueries({ queryKey: queryKeys.admin.settings() });
      await onSaved();
      toast.success(t("spreadsheet_schedule_config_saved"));
      onClose();
    } catch (err) {
      setError(t(err instanceof Error && err.message.startsWith("spreadsheet_schedule_")
        ? err.message : "spreadsheet_schedule_failed"));
    } finally { setSaving(false); }
  }
  return (
    <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {title}
          <SpreadsheetInfo title={title}>
            <p>{t("spreadsheet_schedule_global_config")}</p>
            <p>{t("spreadsheet_schedule_" + target + "_setup")}</p>
            {target === "nas" && <p>{t("spreadsheet_schedule_smb_help")}</p>}
            {target === "drive" && <p>{t("spreadsheet_schedule_drive_oauth_help")}</p>}
            {target === "drive" && (
              <a className="inline-block text-primary underline underline-offset-4"
                href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">
                Google Cloud Console
              </a>
            )}
            <p>{t("spreadsheet_schedule_environment_help")}</p>
            {target === "drive" && <p>{t("spreadsheet_schedule_client_change_help")}</p>}
          </SpreadsheetInfo>
        </DialogTitle>
        <DialogDescription className="sr-only">{t("spreadsheet_schedule_global_config")}</DialogDescription>
      </DialogHeader>
      {target === "nas" ? (
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="spreadsheet-nas-mode">{t("spreadsheet_schedule_nas_mode")}</Label>
            <Select value={nasMode} onValueChange={(value) => setNasMode(value as "directory" | "smb")} disabled={saving}>
              <SelectTrigger id="spreadsheet-nas-mode"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="smb">{t("spreadsheet_schedule_nas_smb")}</SelectItem>
                <SelectItem value="directory">{t("spreadsheet_schedule_nas_mounted")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {nasMode === "smb" ? (
            <>
              <div className="grid gap-2">
                <Label htmlFor="spreadsheet-smb-host">{t("spreadsheet_schedule_smb_host")}</Label>
                <Input id="spreadsheet-smb-host" value={smbHost} required disabled={saving} autoComplete="off"
                  placeholder="192.168.1.100" onChange={(event) => setSmbHost(event.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="spreadsheet-smb-share">{t("spreadsheet_schedule_smb_share")}</Label>
                <Input id="spreadsheet-smb-share" value={smbShare} required disabled={saving} autoComplete="off"
                  placeholder="backup" onChange={(event) => setSmbShare(event.target.value)} />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="spreadsheet-smb-folder">{t("spreadsheet_schedule_smb_folder")}</Label>
                  <SpreadsheetInfo title={t("spreadsheet_schedule_smb_folder")}>
                    <p>{t("spreadsheet_schedule_smb_help")}</p>
                  </SpreadsheetInfo>
                </div>
                <Input id="spreadsheet-smb-folder" value={smbFolder} disabled={saving} autoComplete="off"
                  placeholder="Monline/Excel" onChange={(event) => setSmbFolder(event.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="spreadsheet-smb-user">{t("spreadsheet_schedule_smb_username")}</Label>
                <Input id="spreadsheet-smb-user" value={smbUser} required disabled={saving} autoComplete="off"
                  onChange={(event) => setSmbUser(event.target.value)} />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="spreadsheet-smb-password">{t("spreadsheet_schedule_smb_password")}</Label>
                  <SpreadsheetInfo title={t("spreadsheet_schedule_smb_password")}>
                    <p>{t("spreadsheet_schedule_smb_password_help")}</p>
                  </SpreadsheetInfo>
                </div>
                <Input id="spreadsheet-smb-password" type="password" value={smbPassword} disabled={saving}
                  autoComplete="new-password" required={!config.smb_password_configured}
                  placeholder={config.smb_password_configured ? t("spreadsheet_schedule_secret_saved") : ""}
                  onChange={(event) => setSmbPassword(event.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="spreadsheet-smb-domain">{t("spreadsheet_schedule_smb_domain")}</Label>
                <Input id="spreadsheet-smb-domain" value={smbDomain} disabled={saving} autoComplete="off"
                  placeholder="WORKGROUP" onChange={(event) => setSmbDomain(event.target.value)} />
              </div>
            </>
          ) : (
          <div className="grid gap-2">
          <div className="flex items-center gap-1">
            <Label htmlFor="spreadsheet-nas-directory">{t("spreadsheet_schedule_nas_directory")}</Label>
            <SpreadsheetInfo title={t("spreadsheet_schedule_nas_directory")}>
              <p>{t("spreadsheet_schedule_nas_path_help")}</p>
              {config.environment.nas_directory && <p>{t("spreadsheet_schedule_environment_help")}</p>}
            </SpreadsheetInfo>
          </div>
          <Input id="spreadsheet-nas-directory" value={directory}
            onChange={(event) => setDirectory(event.target.value)}
            disabled={saving || config.environment.nas_directory} placeholder="/exports" autoComplete="off" />
          </div>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-2">
            <Label htmlFor="spreadsheet-google-client-id">{t("spreadsheet_schedule_client_id")}</Label>
            <Input id="spreadsheet-google-client-id" value={clientId} required autoComplete="off"
              disabled={saving || config.environment.google_client_id}
              onChange={(event) => setClientId(event.target.value)} placeholder="….apps.googleusercontent.com" />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="spreadsheet-google-secret">{t("spreadsheet_schedule_client_secret")}</Label>
              <SpreadsheetInfo title={t("spreadsheet_schedule_client_secret")}>
                <p>{t("spreadsheet_schedule_secret_help")}</p>
                {config.environment.google_client_secret && <p>{t("spreadsheet_schedule_environment_help")}</p>}
              </SpreadsheetInfo>
            </div>
            <Input id="spreadsheet-google-secret" type="password" value={secret} autoComplete="new-password"
              required={!config.google_client_secret_configured}
              disabled={saving || config.environment.google_client_secret}
              placeholder={config.google_client_secret_configured ? t("spreadsheet_schedule_secret_saved") : ""}
              onChange={(event) => setSecret(event.target.value)} />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="spreadsheet-public-url">{t("server_url")}</Label>
              <SpreadsheetInfo title={t("server_url")}>
                <p>{t("server_url_help")}</p><p>{t("spreadsheet_schedule_https_help")}</p>
                {config.environment.public_url && <p>{t("spreadsheet_schedule_environment_help")}</p>}
              </SpreadsheetInfo>
            </div>
            <Input id="spreadsheet-public-url" type="url" value={publicUrl} required
              disabled={saving || config.environment.public_url}
              onChange={(event) => setPublicUrl(event.target.value)} placeholder="https://beta.example.com" />
          </div>
          {effectiveCallback && (
            <div className="grid gap-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="spreadsheet-callback">{t("spreadsheet_schedule_callback_label")}</Label>
                <SpreadsheetInfo title={t("spreadsheet_schedule_callback_label")}>
                  <p>{t("spreadsheet_schedule_callback")}</p>
                  <p>{t("spreadsheet_schedule_callback_help")}</p>
                </SpreadsheetInfo>
              </div>
              <Input id="spreadsheet-callback" readOnly value={effectiveCallback} className="text-xs" onFocus={(event) => event.target.select()} />
            </div>
          )}
        </>
      )}
      {(target === "nas" ? nasMode === "directory" && config.environment.nas_directory :
        config.environment.google_client_id || config.environment.google_client_secret || config.environment.public_url) && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {t("spreadsheet_schedule_environment")}
          <SpreadsheetInfo title={t("spreadsheet_schedule_environment")}>
            <p>{t("spreadsheet_schedule_environment_help")}</p>
          </SpreadsheetInfo>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" disabled={saving} onClick={onClose}>{t("cancel")}</Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("save")}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function SpreadsheetDestinationConfig({ target, open, onOpenChange, callbackUrl, refresh }: {
  target: "nas" | "drive"; open: boolean; onOpenChange: (open: boolean) => void;
  callbackUrl: string; refresh: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["spreadsheet-integrations", user?.id, target],
    queryFn: () => api.get<IntegrationConfig>("/api/spreadsheet-integrations"),
    enabled: open, staleTime: 0, gcTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false,
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        {query.isFetching && (
          <DialogHeader>
            <DialogTitle>{t("spreadsheet_schedule_" + target + "_config_title")}</DialogTitle>
            <DialogDescription className="sr-only">{t("spreadsheet_schedule_global_config")}</DialogDescription>
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </DialogHeader>
        )}
        {query.isError && !query.isFetching && (
          <DialogHeader>
            <DialogTitle>{t("spreadsheet_schedule_" + target + "_config_title")}</DialogTitle>
            <DialogDescription role="alert" className="text-destructive">{t("spreadsheet_schedule_load_failed")}</DialogDescription>
          </DialogHeader>
        )}
        {open && query.data && !query.isFetching && !query.isError && (
          <ConfigurationForm key={target + query.dataUpdatedAt} target={target} config={query.data}
            callbackUrl={callbackUrl} onClose={() => onOpenChange(false)} onSaved={refresh} />
        )}
      </DialogContent>
    </Dialog>
  );
}
