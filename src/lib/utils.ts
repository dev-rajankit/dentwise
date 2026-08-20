import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { AppointmentStatus } from "@prisma/client";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ---------------------------------------------------------------------------
// appointment date helpers
//
// every appointment date moves through the app as "YYYY-MM-DD" derived from a
// UTC value - toDateOnly() stores UTC midnight and transformAppointment()
// formats with .toISOString().split("T")[0]. so comparing those strings
// lexicographically is exact: no Date re-parsing, no local-vs-UTC drift, and
// the client reaches the same verdict the server does.
//
// structurally typed rather than tied to TransformedAppointment so these also
// work for the admin table or any future appointment shape.
// ---------------------------------------------------------------------------

export function getTodayDateOnly() {
  return new Date().toISOString().split("T")[0];
}

type AppointmentLike = { date: string; time: string; status: AppointmentStatus };

// today counts as upcoming - the appointment has not happened yet
export function isUpcomingAppointment(appointment: Pick<AppointmentLike, "date">) {
  return appointment.date >= getTodayDateOnly();
}

// MUST stay in sync with cancelAppointment's server-side rule, so the button is
// never offered for something the action will reject (and never hidden for
// something it would allow).
export function isCancellableAppointment(appointment: Pick<AppointmentLike, "date" | "status">) {
  return appointment.status === "CONFIRMED" && isUpcomingAppointment(appointment);
}

// splits one list into the two sections the UI shows, each in the order that
// reads best: upcoming soonest-first, past most-recent-first. sorted explicitly
// rather than relying on the query's orderBy, so any caller gets it right.
export function partitionAppointments<T extends AppointmentLike>(appointments: T[]) {
  const upcoming: T[] = [];
  const past: T[] = [];

  for (const appointment of appointments) {
    if (isUpcomingAppointment(appointment)) upcoming.push(appointment);
    else past.push(appointment);
  }

  const byDateTime = (a: T, b: T) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time);

  upcoming.sort(byDateTime);
  past.sort((a, b) => byDateTime(b, a));

  return { upcoming, past };
}

// Was avatar.iran.liara.run, which is unreachable (DNS resolves, connection fails)
// and left every doctor showing a broken-image glyph. DiceBear is CDN-backed and
// deterministic on `seed`, so a given doctor always gets the same face.
export function generateAvatar(name: string, gender: "MALE" | "FEMALE") {
  const username = name.replace(/\s+/g, "").toLowerCase();
  // gender is folded into the seed so the two never collide on one name
  const seed = encodeURIComponent(`${username}-${gender.toLowerCase()}`);
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}`;
}

// phone formatting function for US numbers - ai generated 🎉
export const formatPhoneNumber = (value: string) => {
  if (!value) return value;

  const phoneNumber = value.replace(/[^\d]/g, "");
  const phoneNumberLength = phoneNumber.length;

  if (phoneNumberLength < 4) return phoneNumber;
  if (phoneNumberLength < 7) {
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
  }
  return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
};

//  ai generated 🎉
export const getNext5Days = () => {
  const dates = [];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  for (let i = 0; i < 5; i++) {
    const date = new Date(tomorrow);
    date.setDate(date.getDate() + i);
    dates.push(date.toISOString().split("T")[0]);
  }

  return dates;
};

export const getAvailableTimeSlots = () => {
  return [
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "14:00",
    "14:30",
    "15:00",
    "15:30",
    "16:00",
    "16:30",
  ];
};

export const APPOINTMENT_TYPES = [
  { id: "checkup", name: "Regular Checkup", duration: "60 min", price: "$120" },
  { id: "cleaning", name: "Teeth Cleaning", duration: "45 min", price: "$90" },
  { id: "consultation", name: "Consultation", duration: "30 min", price: "$75" },
  { id: "emergency", name: "Emergency Visit", duration: "30 min", price: "$150" },
];