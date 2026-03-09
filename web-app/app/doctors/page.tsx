import DoctorExplorer from "@/app/components/DoctorExplorer";

export default function DoctorsPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Find Doctors</h1>
      <p className="text-sm text-neutral-600">
        Browse and filter doctors by specialty.
      </p>
      <DoctorExplorer />
    </main>
  );
}
