import { useEffect, useState } from "react";
import { dateKey } from "../domain/dates";
export function useToday() {
  const [today, setToday] = useState(dateKey);
  useEffect(() => {
    const update = () => setToday(dateKey());
    const timer = window.setInterval(update, 30000);
    window.addEventListener("focus", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, []);
  return today;
}
