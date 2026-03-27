import { createContext, useContext, useState } from "react";
import type { Booking } from "../types";

export interface DragPayload {
  booking: Booking;
  /** fraction (0–1) of where within the card height the grab happened */
  offsetFraction: number;
}

interface CalendarDragContextValue {
  drag: DragPayload | null;
  setDrag: (d: DragPayload | null) => void;
}

const CalendarDragContext = createContext<CalendarDragContextValue>({
  drag: null,
  setDrag: () => {},
});

export function CalendarDragProvider({ children }: { children: React.ReactNode }) {
  const [drag, setDrag] = useState<DragPayload | null>(null);
  return (
    <CalendarDragContext.Provider value={{ drag, setDrag }}>
      {children}
    </CalendarDragContext.Provider>
  );
}

export const useCalendarDrag = () => useContext(CalendarDragContext);
