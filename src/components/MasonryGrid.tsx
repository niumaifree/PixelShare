import { ReactNode, Children, useState, useEffect } from "react";

function useColumnCount() {
  function compute() {
    const w = typeof window !== "undefined" ? window.innerWidth : 1280;
    if (w >= 1200) return 4;
    if (w >= 900) return 3;
    if (w >= 600) return 2;
    return 1;
  }
  const [n, setN] = useState(compute);
  useEffect(() => {
    const cb = () => setN(compute());
    window.addEventListener("resize", cb);
    return () => window.removeEventListener("resize", cb);
  }, []);
  return n;
}

interface MasonryGridProps {
  children: ReactNode;
}

/**
 * True masonry: items distributed round-robin into equal-width columns.
 * Each column is an independent flex-col, so items render at their natural
 * aspect ratio (h-auto) and column heights diverge — giving the staggered
 * bottom edge characteristic of Pinterest-style layouts.
 */
export default function MasonryGrid({ children }: MasonryGridProps) {
  const colCount = useColumnCount();
  const items = Children.toArray(children);

  const cols: ReactNode[][] = Array.from({ length: colCount }, () => []);
  items.forEach((child, i) => cols[i % colCount].push(child));

  return (
    <div className="flex gap-4 items-start" data-testid="image-grid">
      {cols.map((col, ci) => (
        <div key={ci} className="flex flex-col gap-4 min-w-0" style={{ flex: "1 1 0" }}>
          {col}
        </div>
      ))}
    </div>
  );
}
