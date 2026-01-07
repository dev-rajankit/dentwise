// app/api/send-appointment-email/route.ts
export const runtime = "nodejs";


import AppointmentConfirmationEmail from "@/components/emails/AppointmentConfirmationEmail";
import resend from "@/lib/resend";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    // 1. Check if API key exists
    if (!process.env.RESEND_API_KEY) {
      console.error("❌ RESEND_API_KEY not configured");
      return NextResponse.json(
        { error: "Email service not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    console.log("📧 Email request received:", {
      userEmail: body.userEmail,
      doctorName: body.doctorName,
      appointmentDate: body.appointmentDate,
      appointmentTime: body.appointmentTime,
    });

    const {
      userEmail,
      doctorName,
      appointmentDate,
      appointmentTime,
      appointmentType,
      duration,
      price,
    } = body;

    // 2. Validate required fields
    if (!userEmail || !doctorName || !appointmentDate || !appointmentTime) {
      console.error("❌ Missing required fields:", {
        hasUserEmail: !!userEmail,
        hasDoctorName: !!doctorName,
        hasAppointmentDate: !!appointmentDate,
        hasAppointmentTime: !!appointmentTime,
      });
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 3. Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userEmail)) {
      console.error("❌ Invalid email format:", userEmail);
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    console.log("📤 Attempting to send email via Resend...");

    // 4. Send the email
    const { data, error } = await resend.emails.send({
      from: "DentWise <onboarding@resend.dev>", // Use onboarding@resend.dev for testing
      to: [userEmail],
      subject: "Appointment Confirmation - DentWise",
      react: AppointmentConfirmationEmail({
        doctorName,
        appointmentDate,
        appointmentTime,
        appointmentType: appointmentType || "General Checkup",
        duration: duration || "30 minutes",
        price: price || "$100",
      }),
    });

    if (error) {
      console.error("❌ Resend API error:", JSON.stringify(error, null, 2));
      return NextResponse.json(
        { 
          error: "Failed to send email", 
          details: error 
        },
        { status: 500 }
      );
    }

    console.log("✅ Email sent successfully:", data);

    return NextResponse.json(
      { 
        message: "Email sent successfully", 
        emailId: data?.id 
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Email sending error:", error);
    
    // Log detailed error info
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    
    return NextResponse.json(
      { 
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}