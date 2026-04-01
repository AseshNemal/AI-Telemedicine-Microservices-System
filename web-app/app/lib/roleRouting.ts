export function getDashboardPathForRole(role?: string | null) {
  switch ((role || "").toUpperCase()) {
    case "ADMIN":
      return "/admin/dashboard";
    case "DOCTOR":
      return "/doctor/dashboard";
    case "PATIENT":
      return "/patient/profile";
    default:
      return "/auth";
  }
}
