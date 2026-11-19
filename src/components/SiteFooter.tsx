import ThemeToggle from "@/components/ThemeToggle";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <span>Tavernfire. Written by people.</span>
        <ThemeToggle />
      </div>
    </footer>
  );
}
