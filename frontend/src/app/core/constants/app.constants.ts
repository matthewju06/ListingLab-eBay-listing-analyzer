export const CATEGORIES: Record<string, number> = {
  Antiques: 20081,
  Art: 550,
  Baby: 2984,
  'Books & Magazines': 267,
  'Business & Industrial': 12576,
  'Cameras & Photo': 625,
  'Cell Phones & Accessories': 15032,
  'Clothing, Shoes & Accessories': 11450,
  'Coins & Paper Money': 11116,
  Collectibles: 1,
  'Computers/Tablets & Networking': 58058,
  'Consumer Electronics': 293,
  Crafts: 14339,
  'Dolls & Bears': 237,
  'Movies & TV': 11232,
  'Entertainment Memorabilia': 45100,
  'Gift Cards & Coupons': 172008,
  'Health & Beauty': 26395,
  'Home & Garden': 11700,
  'Jewelry & Watches': 281,
  Music: 11233,
  'Musical Instruments & Gear': 619,
  'Pet Supplies': 1281,
  'Pottery & Glass': 870,
  'Sporting Goods': 888,
  'Sports Mem, Cards & Fan Shop': 64482,
  'Tickets & Experiences': 1305,
  'Toys & Hobbies': 220,
  Travel: 3252,
  'Video Games Consoles': 1249,
};

export const CATEGORY_OPTIONS = Object.entries(CATEGORIES)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, id]) => ({ name, id: String(id) }));

export const HISTORY_KEY = 'ebaySearchHistory';
export const MAX_HISTORY = 20;

export const API_BASE_URL = '/api';
