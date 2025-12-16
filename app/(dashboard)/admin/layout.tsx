const layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <main>
      {/* Here Goes Admin Navbar  or dashboard */}
      <h1>Admin Dashboard Layout</h1>
      {children}
    </main>
  );
};

export default layout;
