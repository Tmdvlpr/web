import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bookingsApi } from "../api/bookings";
import { slotsApi } from "../api/slots";
import { usersApi } from "../api/users";
import type { Booking, BookingCreate, BookingUpdate } from "../types";

export function useBookings(date: string | undefined) {
  return useQuery({
    queryKey: ["bookings", date],
    queryFn: () => bookingsApi.getByDate(date!),
    enabled: !!date,
  });
}

export function useActiveBookings() {
  return useQuery({
    queryKey: ["bookings", "active"],
    queryFn: bookingsApi.getActive,
  });
}

export function useUsers(query: string = "") {
  return useQuery({
    queryKey: ["users", "search", query],
    queryFn: () => usersApi.search(query),
    staleTime: 30_000,
  });
}

export function useSlots(date: string | undefined) {
  return useQuery({
    queryKey: ["slots", date],
    queryFn: () => slotsApi.getSlots(date!),
    enabled: !!date,
    staleTime: 60_000,
  });
}

export function useCreateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: BookingCreate) => bookingsApi.create(payload),
    onMutate: async (payload) => {
      const dateStr = payload.start_time.split("T")[0];
      await queryClient.cancelQueries({ queryKey: ["bookings", dateStr] });
      const previous = queryClient.getQueryData<Booking[]>(["bookings", dateStr]);
      const optimistic: Booking = {
        id: -Date.now(),
        title: payload.title,
        description: payload.description ?? null,
        start_time: payload.start_time,
        end_time: payload.end_time,
        user_id: 0,
        user: { id: 0, telegram_id: 0, first_name: null, last_name: null, username: null, role: "user", display_name: "..." },
        created_at: new Date().toISOString(),
        guests: payload.guests ?? [],
        recurrence: (payload.recurrence as Booking["recurrence"]) ?? "none",
        recurrence_until: null,
        recurrence_group_id: null,
        recurrence_days: [],
      };
      queryClient.setQueryData<Booking[]>(["bookings", dateStr], (old = []) => [...old, optimistic]);
      return { previous, dateStr };
    },
    onError: (_err, _payload, ctx) => {
      if (ctx) queryClient.setQueryData(["bookings", ctx.dateStr], ctx.previous);
    },
    onSettled: (_data, _err, payload) => {
      const dateStr = payload.start_time.split("T")[0];
      queryClient.invalidateQueries({ queryKey: ["bookings", dateStr] });
      queryClient.invalidateQueries({ queryKey: ["bookings", "active"] });
      queryClient.invalidateQueries({ queryKey: ["slots", dateStr] });
    },
  });
}

export function useUpdateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: BookingUpdate }) =>
      bookingsApi.update(id, payload),
    onSuccess: (_data, { payload }) => {
      if (payload.start_time) {
        const dateStr = payload.start_time.split("T")[0];
        queryClient.invalidateQueries({ queryKey: ["bookings", dateStr] });
        queryClient.invalidateQueries({ queryKey: ["slots", dateStr] });
      }
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
  });
}

export function useDeleteBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, deleteSeries }: { id: number; deleteSeries?: boolean }) =>
      bookingsApi.delete(id, deleteSeries),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bookings"] }),
  });
}

export function useAdminBookings() {
  return useQuery({
    queryKey: ["admin", "bookings"],
    queryFn: bookingsApi.adminListAll,
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin", "users"],
    queryFn: usersApi.adminListUsers,
  });
}

export function useAdminStats() {
  return useQuery({
    queryKey: ["admin", "stats"],
    queryFn: usersApi.adminStats,
    refetchInterval: 30_000,
  });
}
