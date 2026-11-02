import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { getOccurrencesInMonth, toDateStr } from "@/components/calendar/types";
import { useCalendarMonthData } from "@/components/calendar/useCalendarMonthData";
import { SubscriptionFormModal } from "@/components/SubscriptionFormModal";
import { useSubscriptionForm } from "@/hooks/useSubscriptionForm";
import i18n from "@/lib/i18n";
import { notificationLanguage, SUPPORTED_LANGUAGES } from "@/lib/languages";
import { buildMonthlyBudget } from "@/lib/monthlyBudget";
import { queryKeys } from "@/lib/queryKeys";
import { isTrialDate, subscriptionAmount } from "@/lib/subscriptionTrial";
import type { Currency, Subscription } from "@/types";

const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: {} }) }));
vi.mock("@/hooks/useLogoSearch", () => ({
  useLogoSearch: () => ({ logoUrl: "", logoPreview: null, resolveLogoFile: async () => null }),
}));
vi.mock("@/components/SubscriptionLogo", () => ({ SubscriptionLogo: () => null }));
vi.mock("@/components/SubscriptionLogoSection", () => ({ SubscriptionLogoSection: () => null }));
vi.mock("@/services/subscriptions", () => ({ subscriptionsService: { create: mocks.create, update: mocks.update } }));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const currency: Currency = { id:"try", name:"Turkish Lira", code:"TRY", symbol:"₺", rate:1, is_main:true, user:"owner" };
const cycles = [{ id:"monthly", name:"Monthly" as const }, { id:"yearly", name:"Yearly" as const }];
const categories = [{ id:"category", name:"AI", user:"owner" }];
const sub = (values: Partial<Subscription> = {}): Subscription => ({
  id:"trial", user:"owner", name:"YouTube Premium", price:200, currency:currency.id,
  cycle:"monthly", frequency:1, next_payment:"2026-11-01", start_date:"2026-11-01",
  trial_months:3, trial_start_date:"2026-11-01", auto_renew:true, notify:false,
  notify_days_before:3, inactive:false, expand:{ cycle:cycles[0], currency }, ...values,
});
const clients: QueryClient[] = [];
function wrapper() {
  const client = new QueryClient({ defaultOptions:{ queries:{retry:false,gcTime:0,staleTime:Infinity}, mutations:{retry:false} } });
  clients.push(client);client.setQueryData(queryKeys.cycles(),cycles);
  return function Wrapper({children}: PropsWithChildren) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; };
}
beforeEach(async () => {
  vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(new Date("2026-11-01T12:00:00Z"));
  await i18n.changeLanguage("en");
  mocks.create.mockReset().mockResolvedValue({id:"new-trial"});
  mocks.update.mockReset().mockResolvedValue({id:"trial"});
  Element.prototype.hasPointerCapture=()=>false;
  Element.prototype.setPointerCapture=()=>{};
  Element.prototype.releasePointerCapture=()=>{};
  Element.prototype.scrollIntoView=()=>{};
  vi.stubGlobal("ResizeObserver",class { observe(){} unobserve(){} disconnect(){} });
});
afterEach(() => { cleanup();clients.splice(0).forEach(client=>client.clear());vi.useRealTimers();vi.unstubAllGlobals(); });

it("shows zero in the starting and following trial months, then resumes the stored price", () => {
  const subscription=sub();
  expect([10,11,0,1].map((month,index)=>buildMonthlyBudget([subscription],[currency],[],true,new Date(index<2?2026:2027,month,1))[0]?.amount)).toEqual([0,0,0,200]);
  expect(subscriptionAmount(subscription)).toBe(0);
  expect(subscription.price).toBe(200);
  expect(isTrialDate(subscription,"2027-02-01")).toBe(false);
});
it("adds monthly trial occurrences before returning to yearly billing", () => {
  const subscription=sub({cycle:"yearly",price:1200,expand:{cycle:cycles[1],currency}});
  for (const [year,month] of [[2026,11],[2026,12],[2027,1],[2027,2]]) {
    expect(getOccurrencesInMonth(subscription,year,month,cycles).map(toDateStr)).toEqual([`${year}-${String(month).padStart(2,"0")}-01`]);
  }
  expect(getOccurrencesInMonth(subscription,2027,3,cycles)).toEqual([]);
});
it("passes zero amounts through calendar entries, day totals and panel totals", () => {
  const {result}=renderHook(()=>useCalendarMonthData({subscriptions:[sub()],cycles,currencies:[currency],year:2026,month:11,selectedDay:1}));
  expect(result.current.entriesByDay[1][0].amount).toBe(0);
  expect(result.current.selectedDayTotal).toBe(0);
  expect(result.current.stats.total).toBe(0);
});
it("keeps an explicitly recorded payment authoritative during a trial", () => {
  const entries=buildMonthlyBudget([sub()],[currency],[{id:"record",user:"owner",subscription_id:"trial",due_date:"2026-11-01",amount:25,paid_at:"2026-11-01T00:00:00Z"}],true,new Date(2026,10,1));
  expect(entries[0].amount).toBe(25);expect(entries[0].status).toBe("paid");
});
it("respects history clearing without recreating erased free months", () => {
  expect(getOccurrencesInMonth(sub({calendar_projection_from:"2026-12-01"}),2026,11,cycles)).toEqual([]);
});
it("reloads trial settings in the edit form and validates the trial duration", async () => {
  const options = { sub:sub(), currencies:[currency], categories, household:[] };
  const {result}=renderHook(()=>useSubscriptionForm(options),{wrapper:wrapper()});
  expect(result.current.getValues("trial_enabled")).toBe(true);
  expect(result.current.getValues("trial_duration")).toBe("3");
  expect(result.current.getValues("trial_start_date")).toBe("2026-11-01");
  act(()=>result.current.setValue("trial_duration","0"));
  let valid=true;await act(async()=>{valid=await result.current.trigger("trial_duration");});
  expect(valid).toBe(false);
});
it.each([
  ["First 1 week", "week", 1], ["First 2 weeks", "week", 2], ["First 3 weeks", "week", 3],
  ["First 1 month", "month", 1], ["First 2 months", "month", 2], ["First 3 months", "month", 3],
  ["First 6 months", "month", 6],
] as const)("saves the %s trial preset with its normal price", async (label, unit, duration) => {
  const saved=vi.fn();
  render(<SubscriptionFormModal sub={null} userId="owner" currencies={[currency]} categories={categories} paymentMethods={[]} household={[]} onClose={vi.fn()} onSaved={saved}/>,{wrapper:wrapper()});
  await userEvent.click(screen.getByRole("checkbox",{name:"Free trial"}));
  await userEvent.click(screen.getByRole("combobox", { name: "Trial length" }));
  await userEvent.click(screen.getByRole("option", { name: label }));
  fireEvent.change(screen.getByLabelText(/^Name/),{target:{value:"YouTube Premium"}});
  fireEvent.change(screen.getByLabelText(/Price after trial/),{target:{value:"200"}});
  await userEvent.click(screen.getByRole("combobox",{name:/Category/}));
  await userEvent.click(screen.getByRole("option",{name:"AI"}));
  await userEvent.click(screen.getByRole("button",{name:"Save"}));
  await waitFor(()=>expect(saved).toHaveBeenCalledOnce());
  expect(mocks.create).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    price:200,trial_months:0,trial_duration:duration,trial_unit:unit,trial_start_date:"2026-11-01",next_payment:"2026-11-01",start_date:"2026-11-01",
  }));
});
it("supports Hungarian, native weekdays and the translated trial workflow", async () => {
  expect(SUPPORTED_LANGUAGES.find(language=>language.code==="hu")?.name).toBe("Magyar");
  expect(notificationLanguage("hu-HU")).toBe("hu");
  await i18n.changeLanguage("hu-HU");
  expect(i18n.t("trial_period")).toBe("Próbaidő");
  expect(i18n.t("paid")).toBe("Fizetve");
  for(const [index,key]of ["sun","mon","tue","wed","thu","fri","sat"].entries())
    expect(i18n.t(key).toLocaleLowerCase("hu")).toBe(new Intl.DateTimeFormat("hu",{weekday:"long"}).format(new Date(2026,10,1+index)).toLocaleLowerCase("hu"));
});


it("preserves an existing monthly trial when saving unrelated changes", async () => {
  const saved = vi.fn();
  render(<SubscriptionFormModal sub={sub({category:"category"})} userId="owner" currencies={[currency]} categories={categories} paymentMethods={[]} household={[]} onClose={vi.fn()} onSaved={saved}/>,{wrapper:wrapper()});
  await userEvent.click(screen.getByRole("button",{name:"Save"}));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(mocks.update).toHaveBeenCalledWith("trial",expect.objectContaining({trial_months:3,trial_duration:0,trial_unit:""}));
});

it("loads a saved flexible trial and keeps an imported duration available without rounding it to a preset", async () => {
  const options = {sub:sub({trial_months:0,trial_duration:7,trial_unit:"day"}),currencies:[currency],categories,household:[]};
  const {result}=renderHook(() => useSubscriptionForm(options),{wrapper:wrapper()});
  expect(result.current.getValues("trial_unit")).toBe("day");
  expect(result.current.getValues("trial_duration")).toBe("7");
  render(<SubscriptionFormModal sub={sub({category:"category",trial_months:0,trial_duration:7,trial_unit:"day"})} userId="owner" currencies={[currency]} categories={categories} paymentMethods={[]} household={[]} onClose={vi.fn()} onSaved={vi.fn()}/>,{wrapper:wrapper()});
  await userEvent.click(screen.getByRole("combobox",{name:"Trial length"}));
  expect(screen.getByRole("option",{name:"7 Days"})).toHaveAttribute("aria-disabled","true");
});
