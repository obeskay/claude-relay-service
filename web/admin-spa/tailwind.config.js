/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: {
          DEFAULT: 'hsl(var(--background))',
          // Color layering shades (1=deepest, 4=pops forward)
          1: 'hsl(var(--background-shade-1))',
          2: 'hsl(var(--background-shade-2))',
          3: 'hsl(var(--background-shade-3))',
          4: 'hsl(var(--background-shade-4))'
        },
        foreground: {
          DEFAULT: 'hsl(var(--foreground))',
          // Text hierarchy shades (1=darkest/brightest, 4=subtle)
          1: 'hsl(var(--foreground-shade-1))',
          2: 'hsl(var(--foreground-shade-2))',
          3: 'hsl(var(--foreground-shade-3))',
          4: 'hsl(var(--foreground-shade-4))'
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
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
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        chart: {
          1: 'hsl(var(--chart-1))',
          2: 'hsl(var(--chart-2))',
          3: 'hsl(var(--chart-3))',
          4: 'hsl(var(--chart-4))',
          5: 'hsl(var(--chart-5))'
        }
      },
      // Two-layer shadow system with top highlight + bottom shadow
      boxShadow: {
        // Small - for subtle elements, tabs, nav items
        'depth-sm': 'var(--shadow-sm)',
        // Medium - for cards, dropdowns (standard depth)
        'depth-md': 'var(--shadow-md)',
        // Large - for hover states, focused elements
        'depth-lg': 'var(--shadow-lg)',
        // XL - for important modals, popovers
        'depth-xl': 'var(--shadow-xl)',
        // Individual layers for custom combinations
        'highlight-sm': 'inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        'highlight-md': 'inset 0 1px 0 rgba(255, 255, 255, 0.12)',
        'highlight-lg': 'inset 0 1px 0 rgba(255, 255, 255, 0.15)',
        // Colored shadows for semantic buttons
        'primary-glow': '0 4px 14px -3px hsl(var(--primary) / 0.35)',
        'success-glow': '0 4px 14px -3px hsl(var(--success) / 0.35)',
        'destructive-glow': '0 4px 14px -3px hsl(var(--destructive) / 0.35)',
        'warning-glow': '0 4px 14px -3px hsl(var(--warning) / 0.35)'
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      backgroundImage: {
        // Gradient presets for premium shiny effect
        'gradient-surface': 'var(--gradient-surface)',
        'gradient-interactive': 'var(--gradient-interactive)',
        'gradient-primary': 'var(--gradient-primary)',
        'gradient-success': 'var(--gradient-success)',
        'gradient-destructive': 'var(--gradient-destructive)',
        'gradient-warning': 'var(--gradient-warning)'
      },
      animation: {
        gradient: 'gradient 8s ease infinite',
        float: 'float 6s ease-in-out infinite',
        'float-delayed': 'float 6s ease-in-out infinite 2s',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'shine': 'shine 2s ease-in-out infinite'
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
        shine: {
          '0%': { 'background-position': '-200% center' },
          '100%': { 'background-position': '200% center' }
        }
      }
    }
  },
  plugins: []
}
