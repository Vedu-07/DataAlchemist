'use client'; 

import { useState, useEffect } from 'react';
import { FiSun, FiMoon } from 'react-icons/fi'; 
import { Button } from './ui/button'; 

export default function ThemeToggler() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light'); 

  useEffect(() => {
    const storedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    let initialTheme: 'light' | 'dark';
    if (storedTheme) {
      initialTheme = storedTheme as 'light' | 'dark';
    } else {
      initialTheme = prefersDark ? 'dark' : 'light';
    }

    setTheme(initialTheme);
    document.documentElement.classList.toggle('dark', initialTheme === 'dark');
  }, []); 

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  return (
    <Button className='cursor-pointer' variant="ghost" size="icon" onClick={toggleTheme}>
      {theme === 'light' ? (
        <FiSun className="h-6 w-6" />
      ) : (
        <FiMoon className="h-6 w-6" />
      )}
    </Button>
  );
}