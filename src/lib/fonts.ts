// src/lib/fonts.ts
import localFont from 'next/font/local'

// Optimized TiemposText for body text
export const tiemposText = localFont({
  src: [
    {
      path: '../../public/fonts/TiemposText-Regular.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/fonts/TiemposText-RegularItalic.otf',
      weight: '400',
      style: 'italic',
    },
    {
      path: '../../public/fonts/TiemposText-Medium.otf',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../../public/fonts/TiemposText-MediumItalic.otf',
      weight: '500',
      style: 'italic',
    },
    {
      path: '../../public/fonts/TiemposText-Semibold.otf',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../../public/fonts/TiemposText-SemiboldItalic.otf',
      weight: '600',
      style: 'italic',
    },
    {
      path: '../../public/fonts/TiemposText-Bold.otf',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../../public/fonts/TiemposText-BoldItalic.otf',
      weight: '700',
      style: 'italic',
    },
  ],
  variable: '--font-text',
  display: 'swap',
  preload: true, // Primary font for body text
})

// Optimized TiemposHeadline for headings
export const tiemposHeadline = localFont({
  src: [
    {
      path: '../../public/fonts/TiemposHeadline-Light.otf',
      weight: '300',
      style: 'normal',
    },
    {
      path: '../../public/fonts/TiemposHeadline-Regular.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/fonts/TiemposHeadline-RegularItalic.otf',
      weight: '400',
      style: 'italic',
    },
    {
      path: '../../public/fonts/TiemposHeadline-Medium.otf',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../../public/fonts/TiemposHeadline-Semibold.otf',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../../public/fonts/TiemposHeadline-Bold.otf',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../../public/fonts/TiemposHeadline-BoldItalic.otf',
      weight: '700',
      style: 'italic',
    },
    {
      path: '../../public/fonts/TiemposHeadline-Black.otf',
      weight: '900',
      style: 'normal',
    },
  ],
  variable: '--font-headline',
  display: 'swap',
  preload: false, // Secondary font, don't preload
})