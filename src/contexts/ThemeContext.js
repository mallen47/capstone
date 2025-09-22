import React, { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext()

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('light')

  // Get system theme preference
  const getSystemTheme = () => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  // Initialize theme on component mount
  useEffect(() => {
    // Check for saved theme preference first
    const savedTheme = localStorage.getItem('theme')
    
    if (savedTheme) {
      // User has manually set a preference
      setTheme(savedTheme)
      document.documentElement.setAttribute('data-bs-theme', savedTheme)
    } else {
      // No saved preference, use system theme
      const systemTheme = getSystemTheme()
      setTheme(systemTheme)
      document.documentElement.setAttribute('data-bs-theme', systemTheme)
    }
  }, [])

  // Toggle between light and dark theme
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    
    // Save user preference to localStorage (overrides system preference)
    localStorage.setItem('theme', newTheme)
    
    // Apply theme to document
    document.documentElement.setAttribute('data-bs-theme', newTheme)
    
    // Debug logging
    console.log('Theme changed to:', newTheme)
    console.log('data-bs-theme attribute:', document.documentElement.getAttribute('data-bs-theme'))
  }

  // Set specific theme
  const setSpecificTheme = (newTheme) => {
    if (newTheme === 'light' || newTheme === 'dark') {
      setTheme(newTheme)
      localStorage.setItem('theme', newTheme)
      document.documentElement.setAttribute('data-bs-theme', newTheme)
    }
  }

  const value = {
    theme,
    toggleTheme,
    setTheme: setSpecificTheme,
    isDark: theme === 'dark'
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}