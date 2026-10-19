import { useEffect, useState } from "react";

import { toDateStr } from "@/components/calendar/types";

export function useLocalToday() {
  const [today, setToday] = useState(() => toDateStr(new Date()));
  useEffect(() => {
    let timer = 0;
    const refresh = () => {
      const now = new Date();
      setToday(toDateStr(now));
      window.clearTimeout(timer);
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = window.setTimeout(refresh, midnight.getTime() - now.getTime() + 100);
    };
    const resume = () => {
      if (document.visibilityState === "visible") refresh();
    };
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", resume);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", resume);
    };
  }, []);
  return today;
}
