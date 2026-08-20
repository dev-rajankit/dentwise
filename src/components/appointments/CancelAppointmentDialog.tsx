"use client";

import { format } from "date-fns";
import { toast } from "sonner";
import { useCancelAppointment } from "@/hooks/use-appointment";
import type { TransformedAppointment } from "@/lib/actions/appointments";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

interface CancelAppointmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: TransformedAppointment | null;
}

function CancelAppointmentDialog({
  appointment,
  isOpen,
  onClose,
}: CancelAppointmentDialogProps) {
  const cancelAppointmentMutation = useCancelAppointment();

  const handleConfirm = () => {
    if (!appointment) return;

    cancelAppointmentMutation.mutate(appointment.id, {
      onSuccess: () => {
        toast.success("Appointment cancelled");
        onClose();
      },
      // the hook rethrows the action's own message, so an authorization failure
      // reads as "You are not authorized to cancel this appointment" rather than
      // a generic one. the dialog stays open so the user can see what happened.
      onError: (error) => toast.error(error.message),
    });
  };

  // never let a click-outside or Esc close the dialog mid-delete - the mutation
  // is already in flight and the UI would lose track of it
  const handleOpenChange = (open: boolean) => {
    if (!open && !cancelAppointmentMutation.isPending) onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Cancel Appointment</DialogTitle>
          <DialogDescription>
            This permanently deletes the appointment. It cannot be undone, and
            it will not appear in your history.
          </DialogDescription>
        </DialogHeader>

        {appointment && (
          <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-1 text-sm">
            <p className="font-medium text-foreground">
              {appointment.doctorName}
            </p>
            <p className="text-muted-foreground">
              {format(new Date(appointment.date), "EEEE, MMMM d, yyyy")} at{" "}
              {appointment.time}
            </p>
            <p className="text-muted-foreground">{appointment.reason}</p>
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          The time slot will become available for someone else to book.
        </p>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={cancelAppointmentMutation.isPending}
          >
            Keep Appointment
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={cancelAppointmentMutation.isPending}
          >
            {cancelAppointmentMutation.isPending
              ? "Cancelling..."
              : "Cancel Appointment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CancelAppointmentDialog;
