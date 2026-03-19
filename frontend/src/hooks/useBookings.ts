import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi, bookingsApi } from "../lib/api";
import type { BookingCreate, BookingUpdate } from "../types";

export function useBookings(date: string) {
  return useQuery({
    queryKey: ["bookings", date],
    queryFn: () => bookingsApi.getByDate(date),
    enabled: !!date,
  });
}

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: authApi.getUsers,
    staleTime: 5 * 60_000,
  });
}

export function useCreateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: BookingCreate) => bookingsApi.create(payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["bookings"] }); },
  });
}

export function useUpdateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: number } & BookingUpdate) => bookingsApi.update(id, payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["bookings"] }); },
  });
}

export function useDeleteBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, deleteSeries }: { id: number; deleteSeries?: boolean }) =>
      bookingsApi.delete(id, deleteSeries),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["bookings"] }); },
  });
}
