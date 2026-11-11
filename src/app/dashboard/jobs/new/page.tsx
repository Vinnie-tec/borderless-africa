import { Suspense } from "react";

import { requireClient } from "@/lib/marketplace/authorization";
import CreateJobForm from "./create-job-form";

async function NewJobContent() {
  await requireClient();

  return (
    <main>
      <h1>Create a job</h1>
      <p>Describe the work you need a freelancer to complete.</p>

      <CreateJobForm />
    </main>
  );
}

export default function NewJobPage() {
  return (
    <Suspense fallback={<p>Loading job form...</p>}>
      <NewJobContent />
    </Suspense>
  );
}