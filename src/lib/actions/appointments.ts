"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "../prisma";
import { AppointmentStatus, Prisma } from "@prisma/client";

// normalize "2026-08-09" to a stable UTC midnight so that the same slot always
// produces the same stored value - the unique constraint compares exact timestamps.
function toDateOnly(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) throw new Error("Invalid date");
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

function transformAppointment(appointment: any) {
  return {
    ...appointment,
    patientName: `${appointment.user.firstName || ""} ${appointment.user.lastName || ""}`.trim(),
    patientEmail: appointment.user.email,
    doctorName: appointment.doctor.name,
    doctorImageUrl: appointment.doctor.imageUrl || "",
    date: appointment.date.toISOString().split("T")[0],
  };
}

export async function getAppointments() {
  try {
    const appointments = await prisma.appointment.findMany({
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        doctor: { select: { name: true, imageUrl: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return appointments.map(transformAppointment);
  } catch (error) {
    console.log("Error fetching appointments:", error);
    throw new Error("Failed to fetch appointments");
  }
}

export async function getUserAppointments() {
  try {
    // get authenticated user from Clerk
    const { userId } = await auth();
    if (!userId) throw new Error("You must be logged in to view appointments");

    // find user by clerkId from authenticated session
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) throw new Error("User not found. Please ensure your account is properly set up.");

    const appointments = await prisma.appointment.findMany({
      where: { userId: user.id },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        doctor: { select: { name: true, imageUrl: true } },
      },
      orderBy: [{ date: "asc" }, { time: "asc" }],
    });

    return appointments.map(transformAppointment);
  } catch (error) {
    console.error("Error fetching user appointments:", error);
    throw new Error("Failed to fetch user appointments");
  }
}

export async function getUserAppointmentStats() {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("You must be authenticated");

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });

    if (!user) throw new Error("User not found");

    // these calls will run in parallel, instead of waiting each other
    const [totalCount, completedCount] = await Promise.all([
      prisma.appointment.count({
        where: { userId: user.id },
      }),
      prisma.appointment.count({
        where: {
          userId: user.id,
          status: "COMPLETED",
        },
      }),
    ]);

    return {
      totalAppointments: totalCount,
      completedAppointments: completedCount,
    };
  } catch (error) {
    console.error("Error fetching user appointment stats:", error);
    return { totalAppointments: 0, completedAppointments: 0 };
  }
}

export async function getBookedTimeSlots(doctorId: string, date: string) {
  try {
    const appointments = await prisma.appointment.findMany({
      where: {
        doctorId,
        date: toDateOnly(date),
        status: {
          in: ["CONFIRMED", "COMPLETED"], // consider both confirmed and completed appointments as blocking
        },
      },
      select: { time: true },
    });

    return appointments.map((appointment) => appointment.time);
  } catch (error) {
    console.error("Error fetching booked time slots:", error);
    return []; // return empty array if there's an error
  }
}

interface BookAppointmentInput {
  doctorId: string;
  date: string;
  time: string;
  reason?: string;
}

// not exported: a "use server" file may only export async functions
const SLOT_TAKEN_MESSAGE = "That time slot has just been booked. Please pick another one.";

// NOTE: a "use server" module may only export async functions, so failures are
// returned as data rather than thrown. This is also the only way the message
// survives to the client - Next.js redacts thrown server action errors in
// production and replaces them with a generic digest.
export type BookAppointmentResult =
  | { success: true; appointment: ReturnType<typeof transformAppointment> }
  | { success: false; message: string; slotTaken?: boolean };

export async function bookAppointment(input: BookAppointmentInput): Promise<BookAppointmentResult> {
  const { userId } = await auth();
  if (!userId) return { success: false, message: "You must be logged in to book an appointment" };

  if (!input.doctorId || !input.date || !input.time) {
    return { success: false, message: "Doctor, date, and time are required" };
  }

  let date: Date;
  try {
    date = toDateOnly(input.date);
  } catch {
    return { success: false, message: "Invalid appointment date" };
  }

  const user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!user) {
    return { success: false, message: "User not found. Please ensure your account is properly set up." };
  }

  try {
    // the create below is what actually enforces this - the unique constraint on
    // (doctorId, date, time) rejects a second booking even if two requests arrive
    // at the same instant. we only pre-check to fail fast with a clear message.
    const taken = await prisma.appointment.findFirst({
      where: { doctorId: input.doctorId, date, time: input.time },
      select: { id: true },
    });
    if (taken) return { success: false, message: SLOT_TAKEN_MESSAGE, slotTaken: true };

    const appointment = await prisma.appointment.create({
      data: {
        userId: user.id,
        doctorId: input.doctorId,
        date,
        time: input.time,
        reason: input.reason || "General consultation",
        status: "CONFIRMED",
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        doctor: { select: { name: true, imageUrl: true } },
      },
    });

    return { success: true, appointment: transformAppointment(appointment) };
  } catch (error) {
    // P2002 = unique constraint violation. another request won the race between
    // our pre-check and our insert.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false, message: SLOT_TAKEN_MESSAGE, slotTaken: true };
    }

    console.error("Error booking appointment:", error);
    return { success: false, message: "Failed to book appointment. Please try again later." };
  }
}

export async function updateAppointmentStatus(input: { id: string; status: AppointmentStatus }) {
  try {
    const appointment = await prisma.appointment.update({
      where: { id: input.id },
      data: { status: input.status },
    });

    return appointment;
  } catch (error) {
    console.error("Error updating appointment:", error);
    throw new Error("Failed to update appointment");
  }
}