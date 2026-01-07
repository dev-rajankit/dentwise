// stores/appointment-store.ts
import { create } from 'zustand';

interface Appointment {
  id: string;
  doctorName: string;
  patientEmail: string;
  date: string;
  time: string;
  reason: string;
}

interface AppointmentStore {
  // Booking state
  selectedDentistId: string | null;
  selectedDate: string;
  selectedTime: string;
  selectedType: string;
  currentStep: number;
  showConfirmationModal: boolean;
  bookedAppointment: Appointment | null;

  // Actions
  setSelectedDentistId: (id: string | null) => void;
  setSelectedDate: (date: string) => void;
  setSelectedTime: (time: string) => void;
  setSelectedType: (type: string) => void;
  setCurrentStep: (step: number) => void;
  setShowConfirmationModal: (show: boolean) => void;
  setBookedAppointment: (appointment: Appointment | null) => void;
  
  // Complex actions
  selectDentist: (dentistId: string) => void;
  resetBookingForm: () => void;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
}

export const useAppointmentStore = create<AppointmentStore>((set) => ({
  // Initial state
  selectedDentistId: null,
  selectedDate: '',
  selectedTime: '',
  selectedType: '',
  currentStep: 1,
  showConfirmationModal: false,
  bookedAppointment: null,

  // Simple setters
  setSelectedDentistId: (id) => set({ selectedDentistId: id }),
  setSelectedDate: (date) => set({ selectedDate: date }),
  setSelectedTime: (time) => set({ selectedTime: time }),
  setSelectedType: (type) => set({ selectedType: type }),
  setCurrentStep: (step) => set({ currentStep: step }),
  setShowConfirmationModal: (show) => set({ showConfirmationModal: show }),
  setBookedAppointment: (appointment) => set({ bookedAppointment: appointment }),

  // Complex actions
  selectDentist: (dentistId) => set({
    selectedDentistId: dentistId,
    selectedDate: '',
    selectedTime: '',
    selectedType: '',
  }),

  resetBookingForm: () => set({
    selectedDentistId: null,
    selectedDate: '',
    selectedTime: '',
    selectedType: '',
    currentStep: 1,
  }),

  goToNextStep: () => set((state) => ({ currentStep: state.currentStep + 1 })),
  goToPreviousStep: () => set((state) => ({ currentStep: state.currentStep - 1 })),
}));