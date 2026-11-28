/**
 * Deterministic studio product image library and keyword resolver for Dry Delight inventory.
 * Maps product names (from both scrapedCatalog.json and live Firestore docs) and categories
 * cleanly to optimized studio photos in `/product-images/`.
 */

import { BY_NAME_IMAGE_SLUGS } from '../data/productImageSlugs';

export const DEFAULT_PRODUCT_IMAGE = '/product-images/flour-sack.webp';

export function toProductImageSlug(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

export function getExactProductImage(name) {
  const slug = toProductImageSlug(name);
  if (slug && BY_NAME_IMAGE_SLUGS.has(slug)) {
    return `/product-images/by-name/${slug}.webp`;
  }
  return null;
}

export const PRODUCT_IMAGE_LIBRARY = [
  { id: 'flour-sack', label: 'Flour / Maida / Atta', path: '/product-images/flour-sack.webp' },
  { id: 'cheese-block', label: 'Cheese Block (Cheddar / Mozzarella)', path: '/product-images/cheese-block.webp' },
  { id: 'cheese-shredded', label: 'Shredded / Crush Cheese', path: '/product-images/cheese-shredded.webp' },
  { id: 'cheese-slices', label: 'Burger Cheese Slices', path: '/product-images/cheese-slices.webp' },
  { id: 'milk-carton', label: 'Milk & Milk Powder', path: '/product-images/milk-carton.webp' },
  { id: 'whipping-cream', label: 'Whipping & Dairy Cream', path: '/product-images/whipping-cream.webp' },
  { id: 'cooking-oil', label: 'Cooking Oil Tins & Pouches', path: '/product-images/cooking-oil.webp' },
  { id: 'cooking-ghee', label: 'Banaspati Ghee', path: '/product-images/cooking-ghee.webp' },
  { id: 'spice-chili', label: 'Red Chili & Paprika', path: '/product-images/spice-chili.webp' },
  { id: 'spice-masala', label: 'Masala & Ground Spices', path: '/product-images/spice-masala.webp' },
  { id: 'spice-whole', label: 'Whole Spices & Seeds', path: '/product-images/spice-whole.webp' },
  { id: 'herbs-dried', label: 'Italian & Dried Herbs', path: '/product-images/herbs-dried.webp' },
  { id: 'baking-powder-seasoning', label: 'Baking Powders, Salt & Sugar', path: '/product-images/baking-powder-seasoning.webp' },
  { id: 'marinade-coating', label: 'Marinades, Breading & Stock', path: '/product-images/marinade-coating.webp' },
  { id: 'cocoa-vanilla', label: 'Cocoa Powder & Vanilla', path: '/product-images/cocoa-vanilla.webp' },
  { id: 'sauce-ketchup', label: 'Tomato Ketchup', path: '/product-images/sauce-ketchup.webp' },
  { id: 'sauce-pizza', label: 'Pizza & Pasta Sauce', path: '/product-images/sauce-pizza.webp' },
  { id: 'sauce-mayo', label: 'Mayonnaise & Spreads', path: '/product-images/sauce-mayo.webp' },
  { id: 'sauce-chili', label: 'Chili, Hot & Peri Peri Sauce', path: '/product-images/sauce-chili.webp' },
  { id: 'sauce-mustard-green', label: 'Mustard & Green Chili Sauce', path: '/product-images/sauce-mustard-green.webp' },
  { id: 'sauce-bbq-soya', label: 'BBQ, Soya & Steak Sauce', path: '/product-images/sauce-bbq-soya.webp' },
  { id: 'sauce-vinegar', label: 'Vinegar & Lemon Juice', path: '/product-images/sauce-vinegar.webp' },
  { id: 'sauce-honey', label: 'Pure Honey', path: '/product-images/sauce-honey.webp' },
  { id: 'packaging-pizza-box', label: 'Pizza Boxes & Stands', path: '/product-images/packaging-pizza-box.webp' },
  { id: 'packaging-containers', label: 'Takeaway Boxes & Containers', path: '/product-images/packaging-containers.webp' },
  { id: 'packaging-foil-wrap', label: 'Foil, Cling Wrap & Butter Paper', path: '/product-images/packaging-foil-wrap.webp' },
  { id: 'packaging-cutlery', label: 'Disposable Cutlery & Glasses', path: '/product-images/packaging-cutlery.webp' },
  { id: 'bread-crumbs', label: 'Bread Crumbs & Panko', path: '/product-images/bread-crumbs.webp' },
  { id: 'canned-olives', label: 'Black & Sliced Olives', path: '/product-images/canned-olives.webp' },
  { id: 'canned-jalapenos', label: 'Jalapenos (Green & Red)', path: '/product-images/canned-jalapenos.webp' },
  { id: 'canned-mushrooms', label: 'Canned Mushrooms', path: '/product-images/canned-mushrooms.webp' },
  { id: 'canned-corn', label: 'Sweet Corn', path: '/product-images/canned-corn.webp' },
  { id: 'canned-preserves', label: 'Tomato Paste, Cocktail & Pickle', path: '/product-images/canned-preserves.webp' },
  { id: 'pasta-assorted', label: 'Pasta, Macaroni & Spaghetti', path: '/product-images/pasta-assorted.webp' },
  { id: 'frozen-fries', label: 'Frozen French Fries', path: '/product-images/frozen-fries.webp' },
  { id: 'frozen-nuggets', label: 'Chicken Nuggets & Popat', path: '/product-images/frozen-nuggets.webp' },
  { id: 'frozen-kabab-patty', label: 'Patties, Kababs, Fillets & Wings', path: '/product-images/frozen-kabab-patty.webp' },
  { id: 'frozen-pepperoni-sausage', label: 'Pepperoni & Sausages', path: '/product-images/frozen-pepperoni-sausage.webp' },
  { id: 'hygiene-gloves', label: 'Gloves & Hair Caps', path: '/product-images/hygiene-gloves.webp' },
  { id: 'cleaning-supplies', label: 'Detergents, Soap & Sprays', path: '/product-images/cleaning-supplies.webp' },
  { id: 'supplies-tissue-rolls', label: 'Thermal Rolls, Tissue & Tape', path: '/product-images/supplies-tissue-rolls.webp' },
  { id: 'bakery-buns', label: 'Burger & Mighty Buns', path: '/product-images/bakery-buns.webp' },
  { id: 'bakery-flatbread', label: 'Paratha, Shawarma & Wraps', path: '/product-images/bakery-flatbread.webp' },
];

/**
 * Ordered specificity-first keyword matching rules.
 * Checks product name keywords before falling back to category-level rules.
 */
const PRODUCT_NAME_RULES = [
  // Specific multi-word / high-priority matches across categories
  { path: '/product-images/bread-crumbs.webp', patterns: ['bread crumb', 'panko crumb', 'crumbs'] },
  { path: '/product-images/cocoa-vanilla.webp', patterns: ['cocoa', 'vanilla essence'] },
  { path: '/product-images/cheese-slices.webp', patterns: ['slice cheese'] },
  { path: '/product-images/cheese-shredded.webp', patterns: ['mozzarella crush', 'crush cheese', 'shredded'] },
  { path: '/product-images/cheese-block.webp', patterns: ['cheddar', 'mozzarella', 'cheese'] },
  { path: '/product-images/whipping-cream.webp', patterns: ['whipy', 'whip cream', 'cream'] },
  { path: '/product-images/milk-carton.webp', patterns: ['milk'] },

  // Oils & Ghee
  { path: '/product-images/cooking-ghee.webp', patterns: ['ghee'] },
  { path: '/product-images/cooking-oil.webp', patterns: ['cooking oil', ' oil'] },

  // Canned items (before sauces so "Tomato Paste" doesn't hit pizza sauce)
  { path: '/product-images/canned-olives.webp', patterns: ['olive'] },
  { path: '/product-images/canned-jalapenos.webp', patterns: ['jalapeno'] },
  { path: '/product-images/canned-mushrooms.webp', patterns: ['mushroom'] },
  { path: '/product-images/canned-corn.webp', patterns: ['sweet corn'] },
  {
    path: '/product-images/canned-preserves.webp',
    patterns: ['tomato paste', 'fruit cocktail', 'murabba', 'achar', 'mixed pickle', 'peak fresh'],
  },

  // Bakery
  { path: '/product-images/bakery-buns.webp', patterns: ['burger bun', 'mighty bun', 'mr bun', ' bun'] },
  { path: '/product-images/bakery-flatbread.webp', patterns: ['paratha', 'shawarma bread', 'tortilla', 'wrap'] },

  // Frozen & Meats
  { path: '/product-images/frozen-fries.webp', patterns: ['fries'] },
  { path: '/product-images/frozen-nuggets.webp', patterns: ['nugget', 'popat'] },
  { path: '/product-images/frozen-pepperoni-sausage.webp', patterns: ['pepperoni', 'sausage'] },
  {
    path: '/product-images/frozen-kabab-patty.webp',
    patterns: ['kabab', 'patty', 'fillet', 'wings', 'thai topping'],
  },

  // Packaging, Hygiene & Supplies
  { path: '/product-images/hygiene-gloves.webp', patterns: ['glove', 'hair cap'] },
  {
    path: '/product-images/supplies-tissue-rolls.webp',
    patterns: ['thermal', 'tissue', 'packing tape'],
  },
  {
    path: '/product-images/cleaning-supplies.webp',
    patterns: ['washing powder', 'surf', 'dishwash', 'insect killer', 'freshener', 'duster', 'starch adhesive'],
  },
  { path: '/product-images/packaging-pizza-box.webp', patterns: ['pizza box', 'pizza table'] },
  {
    path: '/product-images/packaging-foil-wrap.webp',
    patterns: ['aluminium foil', 'aluminum foil', 'cling roll', 'butter paper'],
  },
  {
    path: '/product-images/packaging-cutlery.webp',
    patterns: ['disposable fork', 'disposable spoon', 'disposable glass', 'burger stick', 'apron'],
  },
  {
    path: '/product-images/packaging-containers.webp',
    patterns: ['container', 'food bag', 'gatta plate', 'packaging'],
  },

  // Pasta & Noodles
  {
    path: '/product-images/pasta-assorted.webp',
    patterns: ['macaroni', 'penne', 'spaghetti', 'fettuccine', 'lasagne', 'pasta '],
  },

  // Sauces & Condiments (after pasta & herbs)
  { path: '/product-images/sauce-honey.webp', patterns: ['honey'] },
  { path: '/product-images/sauce-vinegar.webp', patterns: ['vinegar', 'lemon juice'] },
  { path: '/product-images/sauce-mayo.webp', patterns: ['mayonnaise', 'mayo', 'chicken spread'] },
  { path: '/product-images/sauce-pizza.webp', patterns: ['pizza sauce', 'pasta sauce', 'tomato sachet'] },
  { path: '/product-images/sauce-ketchup.webp', patterns: ['ketchup'] },
  {
    path: '/product-images/sauce-mustard-green.webp',
    patterns: ['yellow mustard', 'american mustard', 'mustard nozzle', 'mustard paste', 'green chili', 'achari mango', 'imli sauce'],
  },
  {
    path: '/product-images/sauce-bbq-soya.webp',
    patterns: ['bbq', 'soya', 'steak sauce', 'worcestershire', 'oyster', 'hp sauce', 'trio pack'],
  },
  {
    path: '/product-images/sauce-chili.webp',
    patterns: ['chili sauce', 'chilli', 'chili pouch', 'hot sauce', 'buffalo', 'chipotle', 'peri peri', 'sriracha', 'tabasco', 'mama sita', 'mamas real'],
  },

  // Spices, Marinades, Flours & Baking
  {
    path: '/product-images/marinade-coating.webp',
    patterns: ['chicken cube', 'chicken stock', 'chicken powder', 'marinade', 'coating', 'breading', 'dashi crackers', 'shawarma seasoning'],
  },
  {
    path: '/product-images/herbs-dried.webp',
    patterns: ['oregano', 'basil', 'parsley', 'rosemary', 'thyme'],
  },
  {
    path: '/product-images/spice-chili.webp',
    patterns: ['red chilli', 'red chili', 'paprika'],
  },
  {
    path: '/product-images/baking-powder-seasoning.webp',
    patterns: [
      'yeast',
      'baking powder',
      'baking soda',
      'meetha soda',
      'sugar',
      'cheeni',
      'salt',
      'namak',
      'glucose',
      'glutamate',
      'tatri',
      'citric',
      'suhaga',
      'eka 300',
      'garlic paste',
      'ginger paste',
      'garlic powder',
      'ginger powder',
      'onion powder',
      'garlic sachet',
      'coconut milk powder',
      'gari barada',
      'sagudana',
      'kachri',
    ],
  },
  {
    path: '/product-images/spice-whole.webp',
    patterns: [
      'black pepper',
      'white pepper',
      'zeera',
      'ilachi',
      'daar chini',
      'dhaniya sabat',
      'ajwain',
      'kalwanji',
      'soonf',
      'white till',
      'imli',
      'kishmish',
      'mustard powder',
    ],
  },
  {
    path: '/product-images/spice-masala.webp',
    patterns: ['masala', 'haldi', 'dhaniya powder'],
  },
  {
    path: '/product-images/flour-sack.webp',
    patterns: ['maida', 'atta', 'flour', 'cornflour', 'sooji'],
  },
];

const CATEGORY_FALLBACK_RULES = [
  { path: '/product-images/flour-sack.webp', patterns: ['flour', 'maida', 'atta'] },
  { path: '/product-images/cheese-block.webp', patterns: ['cheese', 'dairy'] },
  { path: '/product-images/cooking-oil.webp', patterns: ['oil', 'ghee'] },
  { path: '/product-images/spice-masala.webp', patterns: ['spice', 'seasoning', 'marinade'] },
  { path: '/product-images/sauce-chili.webp', patterns: ['sauce', 'mayo', 'condiment'] },
  { path: '/product-images/packaging-containers.webp', patterns: ['packaging', 'disposable', 'box'] },
  { path: '/product-images/canned-preserves.webp', patterns: ['canned', 'preserved'] },
  { path: '/product-images/pasta-assorted.webp', patterns: ['pasta', 'noodle'] },
  { path: '/product-images/frozen-kabab-patty.webp', patterns: ['frozen', 'meat'] },
  { path: '/product-images/cleaning-supplies.webp', patterns: ['cleaning', 'hygiene', 'suppl'] },
  { path: '/product-images/bakery-buns.webp', patterns: ['bakery', 'bun', 'bread'] },
];

export function isValidProductImageUrl(value) {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/')) return true;
  if (/^https?:\/\/\S+$/i.test(trimmed)) return true;
  if (/^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    return trimmed.length <= 220000;
  }
  return false;
}

/**
 * Matches a product's name and category name to the best local studio product image path.
 */
export function matchProductImageByName(productOrName, categoryName = '') {
  const name =
    typeof productOrName === 'string'
      ? productOrName
      : String(productOrName?.name || '');
  const cat =
    typeof productOrName === 'string'
      ? String(categoryName || '')
      : String(productOrName?.categoryName || categoryName || '');

  const normalizedName = ` ${name.trim().toLowerCase()} `;
  const normalizedCat = cat.trim().toLowerCase();

  for (const rule of PRODUCT_NAME_RULES) {
    if (rule.patterns.some((pat) => normalizedName.includes(pat))) {
      return rule.path;
    }
  }

  for (const rule of CATEGORY_FALLBACK_RULES) {
    if (rule.patterns.some((pat) => normalizedCat.includes(pat))) {
      return rule.path;
    }
  }

  return DEFAULT_PRODUCT_IMAGE;
}

export function isGenericStudioImageUrl(value) {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  return /^\/product-images\/[^/]+\.webp$/i.test(trimmed);
}

export function needsProductImageSync(product) {
  if (!product?.id) return false;
  if (!isValidProductImageUrl(product.imageUrl)) return true;
  return isGenericStudioImageUrl(product.imageUrl) && Boolean(getExactProductImage(product.name));
}

/**
 * Resolves the display image URL for any product document:
 * uses custom/by-name `product.imageUrl` when set, upgrades legacy generic
 * studio paths when a per-product `.webp` exists, and falls back cleanly.
 */
export function getProductImage(product) {
  const rawUrl = isValidProductImageUrl(product?.imageUrl) ? product.imageUrl.trim() : '';
  // 1. Custom uploaded / external / already by-name URL wins
  if (rawUrl && !isGenericStudioImageUrl(rawUrl)) {
    return rawUrl;
  }
  // 2. Exact per-product real WebP by slug of the product name
  const exact = getExactProductImage(product?.name);
  if (exact) {
    return exact;
  }
  // 3. Existing generic studio URL if valid
  if (rawUrl) {
    return rawUrl;
  }
  // 4. Fall back to name/category keyword matching → generic .webp
  return matchProductImageByName(product);
}

/**
 * Compresses a browser File image to a square WebP/JPEG data URL under Firestore limits.
 */
export function compressImageFileToDataUrl(file, size = 360, quality = 0.84) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith('image/')) {
      reject(new Error('Please select a valid image file.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid or corrupt image file.'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);

        const scale = Math.min((size - 16) / img.width, (size - 16) / img.height);
        const drawW = Math.round(img.width * scale);
        const drawH = Math.round(img.height * scale);
        const dx = Math.round((size - drawW) / 2);
        const dy = Math.round((size - drawH) / 2);
        ctx.drawImage(img, dx, dy, drawW, drawH);

        let dataUrl = canvas.toDataURL('image/webp', quality);
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        if (dataUrl.length > 200000) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.68);
        }
        resolve(dataUrl);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
