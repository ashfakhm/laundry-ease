import Link from "next/link";

const Home = () => {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-semibold mx-auto">
          Welcome To LaundryEase
        </h1>
        <Link
          href="/sign-in"
          className="inline-flex items-center justify-center rounded-full border px-6 py-3 font-semibold"
        >
          Sign In
        </Link>
        <Link
          href="/sign-up"
          className="inline-flex items-center justify-center rounded-full border px-6 py-3 font-semibold"
        >
          Sign Up
        </Link>
      </div>
    </main>
  );
};

export default Home;
