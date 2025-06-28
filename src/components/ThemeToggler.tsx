// components/ThemeToggler.tsx
'use client'; // Essential for client-side state and browser APIs

import { useState, useEffect } from 'react';
import { FiSun, FiMoon } from 'react-icons/fi'; // Assuming you have react-icons installed
import { Button } from './ui/button'; // Adjust path if your Button component is elsewhere

export default function ThemeToggler() {
  // Initialize state based on a client-side check.
  // We can't rely on `localStorage` or `window.matchMedia` during SSR.
  // So, we'll just set a default that will be corrected by useEffect on the client.
  // For `ClientOnly` wrapping, the initial `null` return makes this less critical,
  // but it's good practice for when the component eventually renders.
  const [theme, setTheme] = useState<'light' | 'dark'>('light'); // Default to light on server/initial render

  useEffect(() => {
    // This code only runs on the client.
    // Check local storage first, then system preference.
    const storedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    let initialTheme: 'light' | 'dark';
    if (storedTheme) {
      initialTheme = storedTheme as 'light' | 'dark';
    } else {
      initialTheme = prefersDark ? 'dark' : 'light';
    }

    setTheme(initialTheme);
    // Apply the class to the documentElement immediately on the client
    document.documentElement.classList.toggle('dark', initialTheme === 'dark');
  }, []); // Empty dependency array means this runs once on mount

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  return (
    <Button variant="ghost" size="icon" onClick={toggleTheme}>
      {/* Render the appropriate icon based on the current client-side theme state */}
      {theme === 'light' ? (
        <FiSun className="h-6 w-6" />
      ) : (
        <FiMoon className="h-6 w-6" />
      )}
    </Button>
  );
}