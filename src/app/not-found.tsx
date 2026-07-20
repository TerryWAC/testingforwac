import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="text-6xl font-black text-night-700">404</p>
      <h1 className="mt-3 text-2xl font-bold text-white">This scene got cut</h1>
      <p className="mt-2 text-sm text-night-400">
        The page you&apos;re after isn&apos;t in the final edit.
      </p>
      <Link href="/dashboard" className="btn-primary mt-6">
        Back to Tonight
      </Link>
    </div>
  );
}
