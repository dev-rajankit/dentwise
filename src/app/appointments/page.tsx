"use client";
import { AppointmentConfirmationModal } from "@/components/appointments/AppointmentConfirmationModal";
import BookingConfirmationStep from "@/components/appointments/BookingConfirmationStep";
import DoctorSelectionStep from "@/components/appointments/DoctorSelectionStep";
import ProgressSteps from "@/components/appointments/ProgressSteps";
import TimeSelectionStep from "@/components/appointments/TimeSelectionStep";
import Navbar from "@/components/Navbar";
import { useBookAppointment, useUserAppointments } from "@/hooks/use-appointment";
import { APPOINTMENT_TYPES } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAppointmentStore } from "@/stores/appointment-store";

function AppointmentsPage() {
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
        onError: (error) => toast.error(`Failed to book appointment: ${error.message}`),
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

      {/* SHOW EXISTING APPOINTMENTS FOR THE CURRENT USER */}
{userAppointments.length > 0 && (
  <div className="container mx-auto px-4 py-8">
    <h2 className="text-xl font-semibold mb-4 text-foreground">
      Your Upcoming Appointments
    </h2>

    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {userAppointments.map((appointment) => (
        <div
          key={appointment.id}
          className="bg-card border border-border rounded-lg p-4 shadow-sm transition hover:scale-[1.02] hover:shadow-md"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="size-10 bg-primary/10 rounded-full flex items-center justify-center overflow-hidden">
              {appointment.doctorImageUrl ? (
                <img
                  src={appointment.doctorImageUrl}
                  alt={appointment.doctorName}
                  className="size-10 rounded-full object-cover"
                />
              ) : (
                <span className="text-sm font-semibold text-primary">
                  {appointment.doctorName?.charAt(0)}
                </span>
              )}
            </div>

            <div>
              <p className="font-medium text-sm text-foreground">
                {appointment.doctorName}
              </p>
              <p className="text-muted-foreground text-xs">
                {appointment.reason}
              </p>
            </div>
          </div>

          <div className="space-y-1 text-sm text-muted-foreground">
            <p>
              📅 {format(new Date(appointment.date), "MMM d, yyyy")}
            </p>
            <p>🕐 {appointment.time}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
)}


    </>
  );
}

export default AppointmentsPage;