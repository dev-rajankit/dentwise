import { useAvailableDoctors } from "@/hooks/use-doctors";
import DoctorAvatar from "@/components/DoctorAvatar";

function DoctorInfo({ doctorId }: { doctorId: string }) {
  const { data: doctors = [] } = useAvailableDoctors();
  const doctor = doctors.find((d) => d.id === doctorId);

  if (!doctor) return null;

  return (
    <div className="flex items-center gap-4">
      <DoctorAvatar name={doctor.name} imageUrl={doctor.imageUrl} className="size-12 text-sm" />
      <div>
        <h3 className="font-medium">{doctor.name}</h3>
        <p className="text-sm text-muted-foreground">{doctor.speciality || "General Dentistry"}</p>
      </div>
    </div>
  );
}

export default DoctorInfo;