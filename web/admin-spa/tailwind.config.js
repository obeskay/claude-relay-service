/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      // ═══════════════════════════════════════════════════════════════════════
      // COLOR SYSTEM - Maps CSS custom properties from variables.css
      // Usage: bg-primary, text-accent, border-muted, etc.
      // ═══════════════════════════════════════════════════════════════════════
      colors: {
        // Base semantic colors
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',

        // Card & Popover
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },

        // Primary - Deep Navy Blue
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },

        // Secondary - Soft Gray
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },

        // Muted
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },

        // Accent - Gold
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },

        // Semantic status colors
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))'
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        error: {
          DEFAULT: 'hsl(var(--error))',
          foreground: 'hsl(var(--error-foreground))'
        },

        // Border & Input
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',

        // Background shades for layering
        'bg-shade': {
          1: 'hsl(var(--background-shade-1))',
          2: 'hsl(var(--background-shade-2))',
          3: 'hsl(var(--background-shade-3))',
          4: 'hsl(var(--background-shade-4))'
        },

        // Foreground shades for text hierarchy
        'fg-shade': {
          1: 'hsl(var(--foreground-shade-1))',
          2: 'hsl(var(--foreground-shade-2))',
          3: 'hsl(var(--foreground-shade-3))',
          4: 'hsl(var(--foreground-shade-4))'
        },

        // Sidebar
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))'
        },

        // Chart colors
        chart: {
          1: 'hsl(var(--chart-1))',
          2: 'hsl(var(--chart-2))',
          3: 'hsl(var(--chart-3))',
          4: 'hsl(var(--chart-4))',
          5: 'hsl(var(--chart-5))'
        }
      },

      // ═══════════════════════════════════════════════════════════════════════
      // BORDER RADIUS - Maps CSS custom properties
      // Usage: rounded-sm, rounded-md, rounded-lg, etc.
      // ═══════════════════════════════════════════════════════════════════════
      borderRadius: {
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)'
      },

      // ═══════════════════════════════════════════════════════════════════════
      // BOX SHADOW - Maps CSS custom properties
      // Usage: shadow-sm, shadow-md, shadow-lg, etc.
      // ═══════════════════════════════════════════════════════════════════════
      boxShadow: {
        '2xs': 'var(--shadow-2xs)',
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
        '2xl': 'var(--shadow-2xl)',
        // Two-layer shadows
        'sm-top': 'var(--shadow-sm-top)',
        'sm-bottom': 'var(--shadow-sm-bottom)',
        'md-top': 'var(--shadow-md-top)',
        'md-bottom': 'var(--shadow-md-bottom)',
        'lg-top': 'var(--shadow-lg-top)',
        'lg-bottom': 'var(--shadow-lg-bottom)',
        'xl-top': 'var(--shadow-xl-top)',
        'xl-bottom': 'var(--shadow-xl-bottom)'
      },

      // ═══════════════════════════════════════════════════════════════════════
      // TYPOGRAPHY - Maps CSS custom properties
      // ═══════════════════════════════════════════════════════════════════════
      fontFamily: {
        sans: 'var(--font-sans)',
        serif: 'var(--font-serif)',
        mono: 'var(--font-mono)'
      },

      // ═══════════════════════════════════════════════════════════════════════
      // BACKGROUND IMAGE - Gradient system
      // Usage: bg-gradient-surface, bg-gradient-primary, etc.
      // ═══════════════════════════════════════════════════════════════════════
      backgroundImage: {
        'gradient-surface': 'var(--gradient-surface)',
        'gradient-interactive': 'var(--gradient-interactive)',
        'gradient-primary': 'var(--gradient-primary)',
        'gradient-accent': 'var(--gradient-accent)',
        'gradient-success': 'var(--gradient-success)',
        'gradient-destructive': 'var(--gradient-destructive)',
        'gradient-warning': 'var(--gradient-warning)'
      },

      // ═══════════════════════════════════════════════════════════════════════
      // ANIMATIONS - Existing + new additions
      // ═══════════════════════════════════════════════════════════════════════
      animation: {
        gradient: 'gradient 8s ease infinite',
        float: 'float 6s ease-in-out infinite',
        'float-delayed': 'float 6s ease-in-out infinite 2s',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-in': 'slide-in 0.2s ease-out',
        'scale-in': 'scale-in 0.15s ease-out'
      },
      keyframes: {
        gradient: {
          '0%, 100%': {
            'background-size': '200% 200%',
            'background-position': 'left center'
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'right center'
          }
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' }
        },
        'pulse-glow': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.8 }
        },
        'fade-in': {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 }
        },
        'slide-in': {
          '0%': { transform: 'translateY(-10px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 }
        },
        'scale-in': {
          '0%': { transform: 'scale(0.95)', opacity: 0 },
          '100%': { transform: 'scale(1)', opacity: 1 }
        }
      },

      // ═══════════════════════════════════════════════════════════════════════
      // SPACING - Uses CSS custom property
      // ═══════════════════════════════════════════════════════════════════════
      spacing: {
        // Keep default Tailwind spacing, add custom token
        'token': 'var(--spacing)'
      }
    }
  },
  plugins: []
}
