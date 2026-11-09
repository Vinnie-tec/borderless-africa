import { Suspense } from "react";
import DashboardContent from "./dashboard-content";

export default function DashboardPage() {
  return (
    <Suspense fallback={<p>Loading your dashboard...</p>}>
      <DashboardContent />
    </Suspense>
  );
}