import Link from "next/link";

const Home = () => {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center space-y-6">
        <h1 className="text-6xl font-semibold mx-auto">
          Welcome To LaundryEase
        </h1>
        <p className="text-xl text-muted-foreground">
          We grab it, track it, deliver it fresh — hassle-free!
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/signin"
            className="inline-flex items-center justify-center rounded-full border px-6 py-3 font-semibold hover:bg-accent transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground px-6 py-3 font-semibold hover:bg-primary/90 transition-colors"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </main>
  );
};

export default Home;
