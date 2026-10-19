import type { StatisticsGroupBy } from "@/components/statistics/statistics.types";

// Balanced amber, lavender, blue, lime, and complementary theme-aware accents.
export const STATISTICS_COLORS = Array.from(
  { length: 10 },
  (_, index) => `rgb(var(--chart-${index + 1}))`,
);

// Vivid pastel tones shared by category slices, legends, and table markers.
export const STATISTICS_CATEGORY_COLORS = [
  "#A78BFA",
  "#60A5FA",
  "#5DD8B0",
  "#FDBA74",
  "#F8A2C5",
  "#A3D977",
  "#67D6E2",
  "#F4D878",
  "#F59C8F",
  "#A5B4FC",
];

export const STATISTICS_GROUPS: StatisticsGroupBy[] = ["category", "payment", "member"];
