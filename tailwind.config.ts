import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				
				// Trading Colors System
				'bg-primary': 'hsl(var(--bg-primary))',
				'bg-secondary': 'hsl(var(--bg-secondary))',
				'bg-tertiary': 'hsl(var(--bg-tertiary))',
				'bg-accent': 'hsl(var(--bg-accent))',
				
				'buy-primary': 'hsl(var(--buy-primary))',
				'buy-secondary': 'hsl(var(--buy-secondary))',
				'sell-primary': 'hsl(var(--sell-primary))',
				'sell-secondary': 'hsl(var(--sell-secondary))',
				
				'text-primary': 'hsl(var(--text-primary))',
				'text-secondary': 'hsl(var(--text-secondary))',
				'text-muted': 'hsl(var(--text-muted))',
				'text-accent': 'hsl(var(--text-accent))',
				'text-info': 'hsl(var(--text-info))',
				
				'emergency-red': 'hsl(var(--emergency-red))',
				'emergency-yellow': 'hsl(var(--emergency-yellow))',
				
				'glass-border': 'hsl(var(--glass-border))',
				
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				}
			},
			fontFamily: {
				'inter': ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
				'mono': ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'emergency-pulse': 'emergency-pulse 1s infinite',
				'pulse-buy': 'pulse-buy 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
				'pulse-sell': 'pulse-sell 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
				'emergency-pulse': {
					'0%, 100%': { opacity: '1' },
					'50%': { opacity: '0.7' }
				},
				'pulse-buy': {
					'0%, 100%': { 
						opacity: '1',
						boxShadow: '0 0 0 rgba(0, 255, 136, 0)'
					},
					'50%': { 
						opacity: '0.7',
						boxShadow: '0 0 20px rgba(0, 255, 136, 0.5)'
					}
				},
				'pulse-sell': {
					'0%, 100%': { 
						opacity: '1',
						boxShadow: '0 0 0 rgba(255, 68, 68, 0)'
					},
					'50%': { 
						opacity: '0.7',
						boxShadow: '0 0 20px rgba(255, 68, 68, 0.5)'
					}
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
