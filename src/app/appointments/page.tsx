"use client";
import { AppointmentConfirmationModal } from "@/components/appointments/AppointmentConfirmationModal";
import BookingConfirmationStep from "@/components/appointments/BookingConfirmationStep";
import DoctorSelectionStep from "@/components/appointments/DoctorSelectionStep";
import ProgressSteps from "@/components/appointments/ProgressSteps";
import TimeSelectionStep from "@/components/appointments/TimeSelectionStep";
import Navbar from "@/components/Navbar";
import AppointmentsSection from "@/components/appointments/AppointmentsSection";
import CancelAppointmentDialog from "@/components/appointments/CancelAppointmentDialog";
import { useBookAppointment, useUserAppointments } from "@/hooks/use-appointment";
import type { TransformedAppointment } from "@/lib/actions/appointments";
import { APPOINTMENT_TYPES, partitionAppointments } from "@/lib/utils";
import { format } from "date-fns";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAppointmentStore } from "@/stores/appointment-store";

function AppointmentsPage() {
  // the appointment the confirmation dialog is asking about; null = dialog closed
  const [appointmentToCancel, setAppointmentToCancel] = useState<TransformedAppointment | null>(
    null
  );

  // Get state and actions from Zustand store
  const {
    selectedDentistId,
    selectedDate,
    selectedTime,
    selectedType,
    currentStep,
    showConfirmationModal,
    bookedAppointment,
    setSelectedDate,
    setSelectedTime,
    setSelectedType,
    setCurrentStep,
    setShowConfirmationModal,
    setBookedAppointment,
    selectDentist,
    resetBookingForm,
  } = useAppointmentStore();

  const bookAppointmentMutation = useBookAppointment();
  const { data: userAppointments = [] } = useUserAppointments();

  // getUserAppointments returns the patient's ENTIRE history with no date
  // filter, which is why this page used to list finished appointments under
  // "Upcoming". split it here rather than in the query so both sections come
  // from one fetch and one cache entry.
  const { upcoming, past } = useMemo(
    () => partitionAppointments(userAppointments),
    [userAppointments]
  );

  const handleBookAppointment = async () => {
    if (!selectedDentistId || !selectedDate || !selectedTime) {
      toast.error("Please fill in all required fields");
      return;
    }

    const appointmentType = APPOINTMENT_TYPES.find((t) => t.id === selectedType);

    bookAppointmentMutation.mutate(
      {
        doctorId: selectedDentistId,
        date: selectedDate,
        time: selectedTime,
        reason: appointmentType?.name,
      },
      {
        onSuccess: async (appointment) => {
          // Store the appointment details to show in the modal
          setBookedAppointment(appointment);

          try {
            const emailResponse = await fetch("/api/send-appointment-email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userEmail: appointment.patientEmail,
                doctorName: appointment.doctorName,
                appointmentDate: format(new Date(appointment.date), "EEEE, MMMM d, yyyy"),
                appointmentTime: appointment.time,
                appointmentType: appointmentType?.name,
                duration: appointmentType?.duration,
                price: appointmentType?.price,
              }),
            });

            if (!emailResponse.ok) console.error("Failed to send confirmation email");
          } catch (error) {
            console.error("Error sending confirmation email:", error);
          }

          // Show the success modal
          setShowConfirmationModal(true);
          
          // Reset form
          resetBookingForm();
        },
        onError: (error) => {
          toast.error(error.message);
          // the slot was taken while the user was on the confirmation step -
          // send them back to pick a new time, with fresh availability
          setSelectedTime("");
          setCurrentStep(2);
        },
      }
    );
  };

  return (
    <>
      <Navbar />
      {/* header */}
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Book an Appointment
          </h1>
          <p className="text-gray-600">
            Find and book with verified dentists in your area
          </p>
        </div>

        <ProgressSteps currentStep={currentStep} />

        {currentStep === 1 && (
          <DoctorSelectionStep
            selectedDentistId={selectedDentistId}
            onContinue={() => setCurrentStep(2)}
            onSelectDentist={selectDentist}
          />
        )}

        {currentStep === 2 && selectedDentistId && (
          <TimeSelectionStep
            selectedDentistId={selectedDentistId}
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            selectedType={selectedType}
            onBack={() => setCurrentStep(1)}
            onContinue={() => setCurrentStep(3)}
            onDateChange={setSelectedDate}
            onTimeChange={setSelectedTime}
            onTypeChange={setSelectedType}
          />
        )}

        {currentStep === 3 && selectedDentistId && (
          <BookingConfirmationStep
            selectedDentistId={selectedDentistId}
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            selectedType={selectedType}
            isBooking={bookAppointmentMutation.isPending}
            onBack={() => setCurrentStep(2)}
            onModify={() => setCurrentStep(2)}
            onConfirm={handleBookAppointment}
          />
        )}
      </div>

      {bookedAppointment && (
        <AppointmentConfirmationModal
          open={showConfirmationModal}
          onOpenChange={setShowConfirmationModal}
          appointmentDetails={{
            doctorName: bookedAppointment.doctorName,
            appointmentDate: format(new Date(bookedAppointment.date), "EEEE, MMMM d, yyyy"),
            appointmentTime: bookedAppointment.time,
            userEmail: bookedAppointment.patientEmail,
          }}
        />
      )}

      {/* THE CURRENT USER'S APPOINTMENTS, SPLIT INTO UPCOMING AND PAST */}
      {userAppointments.length > 0 && (
        <div className="container mx-auto px-4 py-8">
          <AppointmentsSection
            title="Your Upcoming Appointments"
            appointments={upcoming}
            emptyMessage="You have no upcoming appointments. Book one above."
            onCancel={setAppointmentToCancel}
          />

          {/* no onCancel: a past appointment cannot be cancelled, and cancelling
              is a hard delete so there would be nothing left to show anyway */}
          <AppointmentsSection
            title="Past Appointments"
            appointments={past}
            isPast
            initialVisibleCount={6}
          />
        </div>
      )}

      <CancelAppointmentDialog
        isOpen={!!appointmentToCancel}
        onClose={() => setAppointmentToCancel(null)}
        appointment={appointmentToCancel}
      />
    </>
  );
}

export default AppointmentsPage;