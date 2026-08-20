"use client";

import { useState } from "react";
import type { TransformedAppointment } from "@/lib/actions/appointments";
import { Button } from "../ui/button";
import AppointmentCard from "./AppointmentCard";

interface AppointmentsSectionProps {
  title: string;
  appointments: TransformedAppointment[];
  // shown instead of the grid when there is nothing to list. omit it and the
  // whole section disappears when empty (what the past list wants).
  emptyMessage?: string;
  onCancel?: (appointment: TransformedAppointment) => void;
  isPast?: boolean;
  // a patient's history grows without bound, so long lists collapse behind a
  // toggle instead of pushing everything else off the page
  initialVisibleCount?: number;
}

function AppointmentsSection({
  title,
  appointments,
  emptyMessage,
  onCancel,
  isPast = false,
  initialVisibleCount,
}: AppointmentsSectionProps) {
  const [showAll, setShowAll] = useState(false);

  if (appointments.length === 0 && !emptyMessage) return null;

  const isCollapsed =
    !!initialVisibleCount &&
    !showAll &&
    appointments.length > initialVisibleCount;
  const visibleAppointments = isCollapsed
    ? appointments.slice(0, initialVisibleCount)
    : appointments;

  return (
    <section className="mb-10">
      <div className="flex items-baseline gap-2 mb-4">
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        {appointments.length > 0 && (
          <span className="text-sm text-muted-foreground">
            ({appointments.length})
          </span>
        )}
      </div>

      {appointments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {visibleAppointments.map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={appointment}
                onCancel={onCancel}
                isPast={isPast}
              />
            ))}
          </div>

          {!!initialVisibleCount &&
            appointments.length > initialVisibleCount && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-4"
                onClick={() => setShowAll((current) => !current)}
              >
                {showAll ? "Show less" : `Show all ${appointments.length}`}
              </Button>
            )}
        </>
      )}
    </section>
  );
}

export default AppointmentsSection;
