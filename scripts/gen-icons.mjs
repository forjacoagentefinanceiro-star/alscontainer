import sharp from 'sharp'
import { readFileSync } from 'fs'

const svg = readFileSync('./public/favicon.svg')

// apple-touch-icon: 180x180 (iOS home screen)
await sharp(svg).resize(180, 180).png().toFile('./public/apple-touch-icon.png')
console.log('✓ apple-touch-icon.png (180x180)')

// PWA icons
await sharp(svg).resize(192, 192).png().toFile('./public/icon-192.png')
console.log('✓ icon-192.png')

await sharp(svg).resize(512, 512).png().toFile('./public/icon-512.png')
console.log('✓ icon-512.png')
