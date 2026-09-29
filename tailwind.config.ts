
import type {Config} from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    // src/lib contiene classi Tailwind costruite in sorgente (es.
    // src/lib/score-box.ts, che genera bordo e bagliore del box punteggio).
    // Senza questa riga Tailwind non scandisce quei file e le classi non
    // finiscono nel CSS: il bagliore semplicemente non compare, senza
    // nessun errore in build ne' in type-check.
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        body: ['var(--font-pt-sans)', 'sans-serif'],
        headline: ['var(--font-pt-sans)', 'sans-serif'],
        code: ['monospace'],
      },
      colors: {
        brand: {
          yellow: 'hsl(var(--brand-yellow))',
          green: 'hsl(var(--brand-green))',
          lime: 'hsl(var(--brand-lime))',
          cyan: 'hsl(var(--brand-cyan))',
          pink: 'hsl(var(--brand-pink))',
          win: 'hsl(var(--win))',
          'win-deep': 'hsl(var(--win-deep))',
          loss: 'hsl(var(--loss))',
          'loss-deep': 'hsl(var(--loss-deep))',
          draw: 'hsl(var(--draw))',
          'draw-deep': 'hsl(var(--draw-deep))',
          'card-yellow': 'hsl(var(--card-yellow))',
          'card-red': 'hsl(var(--card-red))',
        },
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
        'bg-deep': '#050505',
        'bg-ultra': '#020202',
      },
      boxShadow: {
        'neon': '0 0 10px hsla(var(--primary), 0.3), 0 0 20px hsla(var(--primary), 0.1)',
        'neon-strong': '0 0 15px hsla(var(--primary), 0.5), 0 0 30px hsla(var(--primary), 0.2)',
        'accent-neon': '0 0 10px hsla(var(--accent), 0.3), 0 0 20px hsla(var(--accent), 0.1)',
        'inner-dark': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.5)',
      },
      dropShadow: {
        'neon': '0 0 5px hsla(var(--primary), 0.5)',
        'accent': '0 0 5px hsla(var(--accent), 0.5)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
        'progress-loading': {
          '0%': { transform: 'scaleX(0)' },
          '100%': { transform: 'scaleX(1)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'progress-loading': 'progress-loading 1s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
