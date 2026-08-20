"use client";

import {
  bookAppointment,
  cancelAppointment,
  getAppointments,
  getBookedTimeSlots,
  getUserAppointments,
  updateAppointmentStatus,
} from "@/lib/actions/appointments";
import type { TransformedAppointment } from "@/lib/actions/appointments";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useGetAppointments() {
  const result = useQuery({
    queryKey: ["getAppointments"],
    queryFn: getAppointments,
  });

  return result;
}

export function useBookedTimeSlots(doctorId: string, date: string) {
  return useQuery({
    // doctorId and date MUST be part of the key, otherwise one doctor/date's
    // booked slots get served from cache for a different doctor/date
    queryKey: ["getBookedTimeSlots", doctorId, date],
    queryFn: () => getBookedTimeSlots(doctorId!, date),
    enabled: !!doctorId && !!date, // only run query if both doctorId and date are provided
    staleTime: 0, // availability changes constantly - always refetch on mount
    refetchOnWindowFocus: true, // someone else may have taken the slot while we were away
  });
}

export function useBookAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    // the action returns failures as data so the message survives to production;
    // convert it back into a rejection here so onError handles it as usual
    mutationFn: async (
      input: Parameters<typeof bookAppointment>[0]
    ): Promise<TransformedAppointment> => {
      const result = await bookAppointment(input);
      if (!result.success) throw new Error(result.message);
      return result.appointment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["getUserAppointments"] });
      queryClient.invalidateQueries({ queryKey: ["getAppointments"] });
      queryClient.invalidateQueries({ queryKey: ["getBookedTimeSlots"] });
    },
    onError: (error) => {
      console.error("Failed to book appointment:", error);
      // the slot is gone - drop cached availability so the UI shows the truth
      queryClient.invalidateQueries({ queryKey: ["getBookedTimeSlots"] });
    },
  });
}

// Get user-specific appointments
export function useUserAppointments() {
  const result = useQuery({
    queryKey: ["getUserAppointments"],
    queryFn: getUserAppointments,
  });

  return result;
}

export function useCancelAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    // like bookAppointment, the action returns failures as data so the message
    // survives Next's production error redaction; turn it back into a rejection
    // so error.message reaching onError/the component is the REAL reason
    // ("You are not authorized to cancel this appointment"), not a generic one.
    mutationFn: async (appointmentId: string): Promise<string> => {
      const result = await cancelAppointment(appointmentId);
      if (!result.success) throw new Error(result.message);
      return result.id;
    },
    onSuccess: () => {
      // the patient's own list - the cancelled appointment must disappear from
      // "Your Upcoming Appointments" without a manual refresh
      queryClient.invalidateQueries({ queryKey: ["getUserAppointments"] });

      // the admin table (RecentAppointments) - the row is gone from the DB, so a
      // logged-in admin viewing /admin would otherwise show a phantom appointment
      queryClient.invalidateQueries({ queryKey: ["getAppointments"] });

      // availability. the key is ["getBookedTimeSlots", doctorId, date], so this
      // PREFIX invalidates every cached doctor/date pair - not just the one we
      // cancelled. that matters because the booking flow may hold cached slots
      // for other dates, and the freed slot must read as available immediately.
      queryClient.invalidateQueries({ queryKey: ["getBookedTimeSlots"] });
    },
    onError: (error) => console.error("Failed to cancel appointment:", error),
  });
}

export function useUpdateAppointmentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateAppointmentStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["getAppointments"] });
    },
    onError: (error) => console.error("Failed to update appointment:", error),
  });
}