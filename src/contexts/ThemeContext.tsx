import { createContext, useContext, useState, useEffect } from "react";
import { useWhiteLabel } from "@/contexts/WhiteLabelContext";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  toggleTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const { effectiveTheme, setThemeMode, isLoaded } = useWhiteLabel();
  const [theme, setTheme] = useState<Theme>(() => {
    return "dark";
  });

  useEffect(() => {
    if (isLoaded) {
      setTheme("dark");
    }
  }, [effectiveTheme, isLoaded]);

  const toggleTheme = () => {
    setTheme("dark");
    setThemeMode("dark");
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
