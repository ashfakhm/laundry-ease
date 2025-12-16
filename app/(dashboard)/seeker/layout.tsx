const layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <main>
      {/* Here Goes Navbar or dashboard for seeker */}
      <h1>Seeker Dashboard Layout</h1>
      {children}
    </main>
  );
};

export default layout;
