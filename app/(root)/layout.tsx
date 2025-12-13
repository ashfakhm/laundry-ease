const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div>
      <nav>Navbar</nav>
      <main>{children}</main>
    </div>
  );
};

export default Layout;
