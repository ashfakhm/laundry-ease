const Layout = ({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) => {
  return (
    <div>
      <nav>Navbar</nav>
      <main>{children}</main>
      {modal}
    </div>
  );
};

export default Layout;
