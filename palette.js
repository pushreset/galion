// Every pixel on screen snaps to this list (post.js). Ramps are ordered dark → light
// so toon-lit faces and the outline darkening land on a neighbour of the same hue.
export const PALETTE_HEX = [
  // sea: deep → teal → foam
  '#0c2140', '#12325c', '#174478', '#1d5891', '#256fa8', '#2f87bb', '#3aa0c6',
  '#2b9ea3', '#3fb8b2', '#62d0c2', '#97e6d6', '#cdf5ea', '#f4fffb',
  // wood
  '#1b110b', '#2b1a10', '#3f2616', '#56351f', '#704629', '#8d5c35', '#ad7a48', '#cc9d63', '#e3c088',
  // cream sails / bone
  '#f5ecd2', '#ddcda6', '#b9a57d', '#8a785a',
  // black sails
  '#121219', '#1e1e28', '#2c2c38', '#40404e',
  // navy red
  '#3e0d10', '#6e1619', '#a52623', '#d84a38',
  // fire / lantern / gold
  '#fff4b0', '#ffd24a', '#ff9b26', '#e8591a', '#9c2a10', '#c9952a',
  // smoke
  '#26262b', '#47464c', '#716f74', '#a7a3a4', '#d6d2cf',
  // stone
  '#33333d', '#4e4e5a', '#6f6f7c', '#9695a0', '#bdbab8',
  // sand
  '#a6844e', '#c9a86a', '#e6cc8e', '#f6e6b4',
  // vegetation
  '#173219', '#255022', '#3b762c', '#5f9e38', '#94c54c',
  // iron
  '#1c1e22', '#3a3d44',
  // warm haze
  '#e9a46a', '#f3c58e',
];

export const PALETTE_RGB = PALETTE_HEX.map((h) => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
});
