import { Link } from "@tanstack/react-router";
import { LogOut, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { usersService } from "@/services/users";

export function ProfileMenu() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const name = user?.name || user?.username || user?.email || t("profile");
  const initials = name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("profile_menu")}
          title={t("profile_menu")}
          className="flex h-11 shrink-0 items-center gap-2 rounded-xl border border-border bg-card p-[5px] text-left transition-colors data-[state=open]:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring xl:pr-3"
        >
          <Avatar className="h-8 w-8 rounded-[10px]">
            <AvatarImage
              src={user ? (usersService.avatarUrl(user) ?? undefined) : undefined}
              alt=""
              className="object-cover"
            />
            <AvatarFallback className="rounded-[10px] bg-primary/10 text-xs font-bold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden min-w-0 max-w-[150px] xl:grid">
            <span className="truncate text-xs font-semibold leading-4">{name}</span>
            <span className="truncate text-[10px] leading-4 text-muted-foreground">
              {user?.email}
            </span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className="z-[60] w-64 rounded-2xl border-border bg-card p-2 text-card-foreground shadow-premium"
      >
        <DropdownMenuLabel className="px-3 py-2">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">{user?.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="min-h-11 cursor-pointer rounded-lg px-3">
          <Link to="/settings" search={{ tab: "profile" }}>
            <Settings aria-hidden="true" />
            {t("settings")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={logout}
          className="min-h-11 cursor-pointer rounded-lg px-3 text-destructive"
        >
          <LogOut aria-hidden="true" />
          {t("logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
