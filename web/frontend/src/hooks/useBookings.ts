import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bookingsApi } from "../api/bookings";
import { usersApi } from "../api/users";
import type { BookingCreate, BookingUpdate } from "../types";

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

export function useCreateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: BookingCreate) => bookingsApi.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bookings"] }),
  });
}

export function useUpdateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: BookingUpdate }) =>
      bookingsApi.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bookings"] }),
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
