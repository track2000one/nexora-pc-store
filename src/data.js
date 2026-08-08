export const driveImage = (id) => `https://drive.google.com/uc?export=view&id=${id}`;

export const products = [
  {
    id: 1,
    title: 'AURORA RTX 5070 Ti',
    category: 'GRAPHICS CARD',
    categoryKey: 'parts',
    badge: 'NEW',
    rating: 4.9,
    price: 699.99,
    oldPrice: 899.99,
    image: driveImage('12oaRdfihInZIN8htJA5-mvdTDPMJQKw3'),
    specs: ['16GB GDDR7', 'DLSS 4', 'Ray Tracing', 'OC Edition']
  },
  {
    id: 2,
    title: 'NEXUS 27QX',
    category: 'GAMING MONITOR',
    categoryKey: 'monitor',
    badge: 'BEST SELLER',
    rating: 4.8,
    price: 329.99,
    oldPrice: 429.99,
    image: driveImage('1X0FcogYb3YMtXeryoRehetXlr8ffn1rO'),
    specs: ['27” QHD IPS', '240Hz', '1ms GTG', 'G-SYNC Compatible']
  },
  {
    id: 3,
    title: 'VORTEX K1 PRO',
    category: 'MECHANICAL KEYBOARD',
    categoryKey: 'gear',
    badge: 'LIMITED',
    rating: 4.7,
    price: 109.99,
    oldPrice: 149.99,
    image: driveImage('1jZIN6G_BMcerAF2Sanuy5TPWelaqnP8l'),
    specs: ['Hot-Swappable Switches', 'PBT Keycaps', 'RGB Per-Key', 'Aluminum Frame']
  }
];
