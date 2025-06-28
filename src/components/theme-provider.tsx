"use client";

import {
  ThemeProvider as NextThemesProvider,
  ThemeProviderProps as NextThemesProviderProps, 
} from "next-themes";
import React from "react"; 


interface ThemeProviderProps extends NextThemesProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}