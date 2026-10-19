import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { toast } from "@/lib/toast";
import { serverSettingsService } from "@/services/serverSettings";

import { MaintenanceTab } from "./MaintenanceTab";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => {
      if (key === "logos_deleted" && options) {
        return `deleted ${options.count} logos`;
      }
      return key;
    },
  }),
}));

vi.mock("@/lib/toast", () => ({
  toast: {
    success: vi.fn(),
  },
}));

vi.mock("@/services/serverSettings", () => ({
  serverSettingsService: {
    deleteUnusedLogos: vi.fn(),
  },
}));

describe("MaintenanceTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders correctly", () => {
    render(<MaintenanceTab />);

    expect(screen.queryByRole("heading", { name: "maintenance" })).not.toBeInTheDocument();
    expect(screen.queryByText("maintenance_desc")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "cleanup_logos" })).toBeInTheDocument();
  });

  it("calls cleanupLogos and shows success toast when clicked", async () => {
    vi.mocked(serverSettingsService.deleteUnusedLogos).mockResolvedValue({ deleted: 5 });

    render(<MaintenanceTab />);

    const button = screen.getByRole("button", { name: "cleanup_logos" });
    fireEvent.click(button);

    await waitFor(() => {
      expect(serverSettingsService.deleteUnusedLogos).toHaveBeenCalled();
    });

    expect(toast.success).toHaveBeenCalledWith("deleted 5 logos");
  });
});
