export default function SignupModal() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-gray-700 bg-[#0a0a0a] text-white p-6 shadow-2xl">
        <h2 className="text-2xl font-semibold text-center">Sign In</h2>
        <form className="mt-4 space-y-4">
          <input
            className="w-full rounded border border-gray-700 bg-[#111111] px-4 py-2 text-white placeholder:text-gray-400"
            placeholder="Email"
            type="email"
          />
          <input
            className="w-full rounded border border-gray-700 bg-[#111111] px-4 py-2 text-white placeholder:text-gray-400"
            placeholder="Password"
            type="password"
          />
          <div className="flex gap-3">
            <a
              href="/"
              className="flex-1 rounded border border-gray-700 px-4 py-2 text-center text-white"
            >
              Cancel
            </a>
            <button
              type="submit"
              className="flex-1 rounded bg-primary px-4 py-2 font-semibold text-black"
            >
              Continue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
