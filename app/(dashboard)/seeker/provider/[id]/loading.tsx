export default function Loading() {
  return (
    <main
      className="min-h-screen w-full flex items-center justify-center"
      role="status"
      aria-label="Loading"
    >
      <span className="loading loading-ring loading-xl" aria-label="Loading" />
    </main>
  );
}
