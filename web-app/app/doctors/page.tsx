import DoctorExplorer from "@/app/components/DoctorExplorer";

export default function DoctorsPage() {
  return (
    <main className="page-shell">
      <section className="hero-shell">
        <p className="section-kicker">Care Network</p>
        <h1 className="section-title">Find Doctors</h1>
        <p className="section-subtitle">
        Browse and filter doctors by specialty.
        </p>
      </section>
      <DoctorExplorer />
    </main>
  );
}
