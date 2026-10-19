import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { queryKeys } from "@/lib/queryKeys";
import { toast } from "@/lib/toast";
import { serverSettingsService } from "@/services/serverSettings";

import { RegistrationTab } from "./RegistrationTab";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/lib/toast", () => ({
  toast: {
    success: vi.fn(),
  },
}));

vi.mock("@/services/serverSettings", () => ({
  serverSettingsService: {
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
  },
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

describe("RegistrationTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  const renderComponent = (initialData?: any) => {
    if (initialData) {
      queryClient.setQueryData(queryKeys.admin.settings(), initialData);
    }
    return render(
      <QueryClientProvider client={queryClient}>
        <RegistrationTab />
      </QueryClientProvider>,
    );
  };

  it("renders correctly and loads data", async () => {
    const data = {
      id: 1,
      open_registrations: 1,
      require_email_validation: 0,
    };
    vi.mocked(serverSettingsService.getSettings).mockResolvedValue(data as any);

    renderComponent(data);

    expect(screen.queryByRole("heading", { name: "registration" })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(serverSettingsService.getSettings).toHaveBeenCalled();
    });

    const switches = screen.getAllByRole("switch");
    expect(switches).toHaveLength(3);

    await waitFor(() => {
      expect(switches[0]).toBeChecked(); // open_registrations
      expect(switches[1]).not.toBeChecked(); // require_email_validation
    });
  });

  it("calls mutate when toggling a switch", async () => {
    const data = {
      id: 1,
      open_registrations: 0,
    };
    vi.mocked(serverSettingsService.getSettings).mockResolvedValue(data as any);
    vi.mocked(serverSettingsService.updateSettings).mockResolvedValue({} as any);

    renderComponent(data);

    const switchBtn = await screen.findAllByRole("switch");
    fireEvent.click(switchBtn[0]); // open_registrations

    await waitFor(() => {
      expect(serverSettingsService.updateSettings).toHaveBeenCalledWith({
        open_registrations: true,
      });
    });

    expect(toast.success).toHaveBeenCalledWith("saved");
  });

  it("calls mutate when blurring max_users", async () => {
    const data = {
      id: 1,
      max_users: 10,
    };
    vi.mocked(serverSettingsService.getSettings).mockResolvedValue(data as any);
    vi.mocked(serverSettingsService.updateSettings).mockResolvedValue({} as any);

    const { container } = renderComponent(data);

    await waitFor(() => {
      expect(serverSettingsService.getSettings).toHaveBeenCalled();
    });

    const maxUsersInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    expect(maxUsersInput.value).toBe("10");

    await userEvent.clear(maxUsersInput);
    await userEvent.type(maxUsersInput, "20");
    fireEvent.blur(maxUsersInput);

    await waitFor(() => {
      expect(serverSettingsService.updateSettings).toHaveBeenCalledWith({
        max_users: 20,
      });
    });
  });

  it("calls mutate when blurring server_url", async () => {
    const data = {
      id: 1,
      server_url: "https://old.example.com",
    };
    vi.mocked(serverSettingsService.getSettings).mockResolvedValue(data as any);
    vi.mocked(serverSettingsService.updateSettings).mockResolvedValue({} as any);

    const { container } = renderComponent(data);

    await waitFor(() => {
      expect(serverSettingsService.getSettings).toHaveBeenCalled();
    });

    const serverUrlInput = container.querySelector(
      'input[placeholder="https://app.example.com"]',
    ) as HTMLInputElement;
    expect(serverUrlInput.value).toBe("https://old.example.com");

    await userEvent.clear(serverUrlInput);
    await userEvent.type(serverUrlInput, "https://new.example.com");
    fireEvent.blur(serverUrlInput);

    await waitFor(() => {
      expect(serverSettingsService.updateSettings).toHaveBeenCalledWith({
        server_url: "https://new.example.com",
      });
    });
  });
});
