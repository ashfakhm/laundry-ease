import Link from "next/link";

const Home = () => {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <section className="text-center space-y-6">
        <h1 className="text-6xl font-semibold mx-auto">
          Welcome To LaundryEase
        </h1>
        <p className="text-xl text-muted-foreground">
          We grab it, track it, deliver it fresh — hassle-free!
        </p>
        <nav className="flex items-center justify-center gap-4">
          <Link
            href="/choose-role"
            className="inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground px-6 py-3 font-semibold hover:bg-primary/90 transition-colors"
          >
            Get Started
          </Link>
          <Link
            href="/auth"
            className="inline-flex items-center justify-center rounded-full border px-6 py-3 font-semibold hover:bg-accent transition-colors"
          >
            Sign In
          </Link>
        </nav>
      </section>
    </main>
  );
};

export default Home;
