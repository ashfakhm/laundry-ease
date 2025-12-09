"use client";

export default function Login() {
  return (
    <div className="flex flex-col gap-4 mt-6">
      <h2>Login</h2>
      <form className="flex flex-col gap-4">
        <input
          type="email"
          placeholder="Email"
          className="px-4 py-2 rounded border"
        />
        <input
          type="password"
          placeholder="Password"
          className="px-4 py-2 rounded border"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-primary text-black rounded"
        >
          Sign In
        </button>
      </form>
    </div>
  );
}
