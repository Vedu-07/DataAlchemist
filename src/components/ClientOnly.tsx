// components/ClientOnly.tsx
'use client'; // This directive makes it a Client Component

import { useState, useEffect, ReactNode } from 'react';

interface ClientOnlyProps {
  children: ReactNode;
}

export default function ClientOnly({ children }: ClientOnlyProps) {
  const [hasMounted, setHasMounted] = useState(false);

  // This useEffect will only run on the client side after initial render
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // If not mounted (i.e., on server or initial client render before useEffect), render nothing
  if (!hasMounted) {
    return null;
  }

  // Once mounted on the client, render the children
  return <>{children}</>;
}