import Aura from '@primeuix/themes/aura'
import { definePreset } from '@primeuix/themes'
export const interactionTheme = definePreset(Aura, {
  semantic: {
    primary: { 50: '{sky.50}', 100: '{sky.100}', 200: '{sky.200}', 300: '{sky.300}', 400: '{sky.400}', 500: '{sky.500}', 600: '{sky.600}', 700: '{sky.700}', 800: '{sky.800}', 900: '{sky.900}', 950: '{sky.950}' },
    colorScheme: { dark: { surface: { 0: '#ffffff', 50: '#f3f8fd', 100: '#dce9f6', 200: '#bdd2e7', 300: '#91aecb', 400: '#6f90b1', 500: '#4d6f94', 600: '#2b4c70', 700: '#1d3a5d', 800: '#122943', 900: '#0c1d34', 950: '#071426' } } },
  },
})
