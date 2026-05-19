import { useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  onShare?: () => void;
}

export default function Header({ onShare }: HeaderProps) {
  const { isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const [location, setLocation] = useLocation();

  const navLink = (href: string, label: string) => {
    const active = location === href;
    return (
      <button
        key={href}
        onClick={() => setLocation(href)}
        className={`font-medium text-[0.95rem] transition-colors bg-transparent border-0 cursor-pointer whitespace-nowrap ${
          active ? "text-primary" : "text-[#444] hover:text-primary"
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <header className="sticky top-0 z-[1000] bg-white/90 backdrop-blur-[12px] border-b border-gray-200 px-[4%] py-[0.8rem]">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-6">
        {/* Logo */}
        <button
          onClick={() => setLocation("/")}
          className="text-primary text-[1.4rem] font-[800] tracking-[-0.5px] bg-transparent border-0 cursor-pointer flex-shrink-0"
        >
          PixelShare
        </button>

        {/* Right-side nav — everything in one row */}
        <nav className="flex items-center gap-5 flex-shrink-0">
          {navLink("/", "Browse")}
          {navLink("/community", "Community")}

          {isSignedIn ? (
            <>
              {navLink("/collection", "My Collection")}

              {onShare && (
                <Button
                  size="sm"
                  onClick={onShare}
                  className="rounded-full bg-primary hover:bg-primary/90 text-white font-semibold px-4 gap-1.5"
                >
                  <Upload size={15} />
                  Share
                </Button>
              )}

              <div className="flex items-center gap-3 border-l border-gray-200 pl-5">
                <div className="w-8 h-8 rounded-full bg-primary/10 overflow-hidden flex items-center justify-center text-primary font-bold flex-shrink-0">
                  {user.imageUrl ? (
                    <img src={user.imageUrl} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span>{user.firstName?.charAt(0) || "U"}</span>
                  )}
                </div>
                <button
                  onClick={() => signOut()}
                  className="text-sm font-medium text-gray-500 hover:text-primary transition-colors bg-transparent border-0 cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={() => setLocation("/sign-in")}
              className="text-primary font-semibold text-[0.95rem] hover:text-primary/80 transition-colors bg-transparent border-0 cursor-pointer"
            >
              Log In
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
