"use client";

import { format } from "date-fns";
import DoctorAvatar from "@/components/DoctorAvatar";
import type { TransformedAppointment } from "@/lib/actions/appointments";
import { cn, isCancellableAppointment } from "@/lib/utils";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

// "Past" covers the gap the schema leaves: a CONFIRMED appointment whose date
// has gone by was never marked COMPLETED by an admin, so neither enum value
// describes it honestly.
function statusLabel(
  status: TransformedAppointment["status"],
  isPast: boolean,
) {
  if (status === "COMPLETED") return "Completed";
  return isPast ? "Past" : "Confirmed";
}

interface AppointmentCardProps {
  appointment: TransformedAppointment;
  // presentational by design: the card never mutates anything itself, it just
  // reports the intent upward. omit onCancel (e.g. for past appointments) and
  // no cancel affordance renders at all.
  onCancel?: (appointment: TransformedAppointment) => void;
  // past appointments are de-emphasised and show what became of them
  isPast?: boolean;
}

function AppointmentCard({
  appointment,
  onCancel,
  isPast = false,
}: AppointmentCardProps) {
  // guarded here as well as by the caller: a card can never offer a cancel the
  // server would refuse, no matter which list it is rendered in
  const canCancel = !!onCancel && isCancellableAppointment(appointment);

  return (
    <div
      className={cn(
        "bg-card border border-border rounded-lg p-4 shadow-sm transition hover:shadow-md",
        isPast ? "opacity-70 hover:opacity-100" : "hover:scale-[1.02]",
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <DoctorAvatar
            name={appointment.doctorName}
            imageUrl={appointment.doctorImageUrl}
            className="size-10 text-xs"
          />

          <div className="min-w-0">
            <p className="font-medium text-sm text-foreground truncate">
              {appointment.doctorName}
            </p>
            <p className="text-muted-foreground text-xs truncate">
              {appointment.reason}
            </p>
          </div>
        </div>

        {/* always shown, including on upcoming cards: the status is the reason a
            cancel button is or is not offered, so hiding it makes a missing
            button look like a bug. a future appointment marked COMPLETED is not
            cancellable, and this is what says so. */}
        <Badge variant="secondary" className="shrink-0 text-[10px]">
          {statusLabel(appointment.status, isPast)}
        </Badge>
      </div>

      <div className="space-y-1 text-sm text-muted-foreground">
        <p>📅 {format(new Date(appointment.date), "MMM d, yyyy")}</p>
        <p>🕐 {appointment.time}</p>
      </div>

      {canCancel && (
        <Button
          variant="outline"
          size="sm"
          className="mt-3 w-full text-destructive hover:text-destructive"
          onClick={() => onCancel(appointment)}
        >
          Cancel
        </Button>
      )}
    </div>
  );
}

export default AppointmentCard;
