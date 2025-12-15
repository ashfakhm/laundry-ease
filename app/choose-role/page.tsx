"use client";
import { useRouter } from "next/navigation";

export default function ChooseRole() {
  const router = useRouter();

  function choose(role: "seeker" | "provider") {
    if (role === "seeker") {
      router.push("/signup/seeker");
    } else {
      router.push("/signup/provider");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-gray-900 via-slate-900 to-zinc-900">
      <div className="w-full max-w-5xl">
        <div className="text-center space-y-4 mb-12">
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl flex items-center justify-center mb-6 shadow-2xl transform rotate-3">
            <svg
              className="w-10 h-10 text-white transform -rotate-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <h1 className="text-5xl font-bold text-white">
            Welcome to LaundryEase
          </h1>
          <p className="text-xl text-gray-400 font-medium">
            Choose your role to get started
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <button
            className="group bg-gray-800/90 backdrop-blur-sm p-10 rounded-3xl border-2 border-gray-700 hover:border-green-500 hover:shadow-2xl hover:shadow-green-500/20 transition-all duration-300 text-left transform hover:-translate-y-2"
            onClick={() => choose("seeker")}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                <svg
                  className="w-10 h-10 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <svg
                className="w-6 h-6 text-gray-500 group-hover:text-green-400 transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-white mb-3">
              I am a Seeker
            </h2>
            <p className="text-gray-400 text-lg leading-relaxed">
              I need laundry services done for me. I&apos;ll drop off or have
              pickup available.
            </p>
            <div className="mt-6 flex items-center text-green-400 font-semibold group-hover:translate-x-2 transition-transform">
              <span>Get Started</span>
              <svg
                className="w-5 h-5 ml-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </div>
          </button>
          <button
            className="group bg-gray-800/90 backdrop-blur-sm p-10 rounded-3xl border-2 border-gray-700 hover:border-purple-500 hover:shadow-2xl hover:shadow-purple-500/20 transition-all duration-300 text-left transform hover:-translate-y-2"
            onClick={() => choose("provider")}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                <svg
                  className="w-10 h-10 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <svg
                className="w-7 h-7 text-gray-500 group-hover:text-purple-400 transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-white mb-3">
              I am a Provider
            </h2>
            <p className="text-gray-400 text-lg leading-relaxed">
              I offer laundry services and want to connect with customers.
            </p>
            <div className="mt-6 flex items-center text-purple-400 font-semibold group-hover:translate-x-2 transition-transform">
              <span>Get Started</span>
              <svg
                className="w-5 h-5 ml-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </div>
          </button>
        </div>
        <div className="text-center mt-8">
          <p className="text-gray-400">
            Already have an account?{" "}
            <a
              href="/auth"
              className="text-blue-400 hover:text-blue-300 font-semibold hover:underline"
            >
              Sign in
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
