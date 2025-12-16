const layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <main>
      {/* Here Goes Navbar or dashboard for provider */}
      <h1>Provider Dashboard Layout</h1>
      {children}
    </main>
  );
};

export default layout;
