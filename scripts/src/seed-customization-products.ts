// One-off seed script: uploads the client-provided pants/shorts/t-shirt GLB models to
// Cloudflare R2 and creates the corresponding catalog products with the correct
// customization behaviour (whole-garment colour/print for pants & shorts, standard
// zone-based customization for the women's t-shirt).
//
// Run with: pnpm --filter @workspace/scripts run seed-customization-products

import fs from "node:fs";
import path from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { db, productsTable } from "@workspace/db";
import type { ProductAddOn } from "@workspace/db";

const BUCKET = process.env["R2_BUCKET_NAME"] ?? "";
const PUBLIC_URL = (process.env["R2_PUBLIC_URL"] ?? "").replace(/\/+$/, "");
const ENDPOINT = process.env["R2_ENDPOINT"] ?? "";
const ACCESS_KEY = process.env["R2_ACCESS_KEY_ID"] ?? "";
const SECRET_KEY = process.env["R2_SECRET_ACCESS_KEY"] ?? "";

if (!ENDPOINT || !ACCESS_KEY || !SECRET_KEY || !PUBLIC_URL || !BUCKET) {
  console.error("R2 env vars are not fully configured. Aborting.");
  process.exit(1);
}

const s3 = new S3Client({
  region: "auto",
  endpoint: ENDPOINT,
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
});

async function uploadModel(localPath: string, friendlyName: string): Promise<string> {
  const buf = fs.readFileSync(localPath);
  const key = `models/${friendlyName}-${Date.now()}-${Math.round(Math.random() * 1e9)}.glb`;
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buf,
    ContentType: "model/gltf-binary",
    CacheControl: "public, max-age=31536000, immutable",
  }));
  const url = `${PUBLIC_URL}/${key}`;
  console.log(`Uploaded ${friendlyName} -> ${url}`);
  return url;
}

const PANT_SHORT_ADD_ONS: ProductAddOn[] = [
  { id: "tee-holder", label: "Tee Holder", imageUrl: null },
  { id: "side-pocket-zip", label: "Side Pocket w/ Zipper", imageUrl: null },
  { id: "velcro", label: "Velcro", imageUrl: null },
];

const ASSETS_DIR = path.resolve(process.cwd(), "../attached_assets");

interface SeedItem {
  file: string;
  friendlyName: string;
  name: string;
  description: string;
  category: "trousers" | "shorts" | "t-shirt";
  gender: "men" | "women";
  sku: string;
  customizationMode: "whole-garment" | "zone";
  addOns: ProductAddOn[] | null;
  priceInPaise: number;
}

const ITEMS: SeedItem[] = [
  {
    file: "men_pant_with_zip-optimized_1783504804994.glb",
    friendlyName: "men-pant-with-zip",
    name: "Men's Golf Pants — With Zip",
    description: "Bespoke men's golf pants with a zippered fly. Fully customizable in a single solid colour or all-over print — the entire garment changes together.",
    category: "trousers",
    gender: "men",
    sku: "KS1008F-ZIP",
    customizationMode: "whole-garment",
    addOns: PANT_SHORT_ADD_ONS,
    priceInPaise: 449900,
  },
  {
    file: "men_pant_without_zip-optimized_1783504804995.glb",
    friendlyName: "men-pant-without-zip",
    name: "Men's Golf Pants — Without Zip (Side Elastic)",
    description: "Bespoke men's golf pants with a side-elastic waist, no zip. Fully customizable in a single solid colour or all-over print — the entire garment changes together.",
    category: "trousers",
    gender: "men",
    sku: "KS1010F-NOZIP",
    customizationMode: "whole-garment",
    addOns: PANT_SHORT_ADD_ONS,
    priceInPaise: 429900,
  },
  {
    file: "men_shorts_with_zip-optimized_1783504804995.glb",
    friendlyName: "men-shorts-with-zip",
    name: "Men's Golf Shorts — With Zip",
    description: "Bespoke men's golf shorts with a zippered fly. Fully customizable in a single solid colour or all-over print — the entire garment changes together.",
    category: "shorts",
    gender: "men",
    sku: "KS1009F-ZIP",
    customizationMode: "whole-garment",
    addOns: PANT_SHORT_ADD_ONS,
    priceInPaise: 329900,
  },
  {
    file: "men_shorts_without_zip-optimized_1783504804996.glb",
    friendlyName: "men-shorts-without-zip",
    name: "Men's Golf Shorts — Without Zip",
    description: "Bespoke men's golf shorts, no zip. Fully customizable in a single solid colour or all-over print — the entire garment changes together.",
    category: "shorts",
    gender: "men",
    sku: "KS1009F-NOZIP",
    customizationMode: "whole-garment",
    addOns: PANT_SHORT_ADD_ONS,
    priceInPaise: 309900,
  },
  {
    file: "women_pant_with_zip-optimized_1783504804997.glb",
    friendlyName: "women-pant-with-zip",
    name: "Women's Golf Pants — With Zip",
    description: "Bespoke women's golf pants with a zippered fly. Same customisation as the men's collection — fully customizable in a single solid colour or all-over print.",
    category: "trousers",
    gender: "women",
    sku: "KL1001-ZIP",
    customizationMode: "whole-garment",
    addOns: PANT_SHORT_ADD_ONS,
    priceInPaise: 449900,
  },
  {
    file: "women_pant_without_zip-optimized_1783504804997.glb",
    friendlyName: "women-pant-without-zip",
    name: "Women's Golf Pants — Without Zip",
    description: "Bespoke women's golf pants, no zip. Same customisation as the men's collection — fully customizable in a single solid colour or all-over print.",
    category: "trousers",
    gender: "women",
    sku: "KL1001-NOZIP",
    customizationMode: "whole-garment",
    addOns: PANT_SHORT_ADD_ONS,
    priceInPaise: 429900,
  },
  {
    file: "women_shorts_with_zip-optimized_1783504804997.glb",
    friendlyName: "women-shorts-with-zip",
    name: "Women's Golf Shorts — With Zip",
    description: "Bespoke women's golf shorts with a zippered fly. Same customisation as the men's collection — fully customizable in a single solid colour or all-over print.",
    category: "shorts",
    gender: "women",
    sku: "KL1002-ZIP",
    customizationMode: "whole-garment",
    addOns: PANT_SHORT_ADD_ONS,
    priceInPaise: 329900,
  },
  {
    file: "women_shorts_without_zip-optimized_1783504804998.glb",
    friendlyName: "women-shorts-without-zip",
    name: "Women's Golf Shorts — Without Zip",
    description: "Bespoke women's golf shorts, no zip. Same customisation as the men's collection — fully customizable in a single solid colour or all-over print.",
    category: "shorts",
    gender: "women",
    sku: "KL1002-NOZIP",
    customizationMode: "whole-garment",
    addOns: PANT_SHORT_ADD_ONS,
    priceInPaise: 309900,
  },
  {
    file: "womens_thsirt_model-optimized_1783504804998.glb",
    friendlyName: "womens-tshirt",
    name: "Women's Golf Tee",
    description: "Bespoke women's golf tee with standard part-based customization — collar, sleeves, and body can each be styled independently.",
    category: "t-shirt",
    gender: "women",
    sku: "KL1003",
    customizationMode: "zone",
    addOns: null,
    priceInPaise: 249900,
  },
];

async function main() {
  for (const item of ITEMS) {
    const localPath = path.join(ASSETS_DIR, item.file);
    if (!fs.existsSync(localPath)) {
      console.error(`Missing file, skipping: ${localPath}`);
      continue;
    }

    const existing = await db.query.productsTable.findFirst({ where: (p, { eq }) => eq(p.sku, item.sku) });
    if (existing) {
      console.log(`Skipping ${item.sku} — a product with this SKU already exists (id ${existing.id}).`);
      continue;
    }

    const modelUrl = await uploadModel(localPath, item.friendlyName);

    const [product] = await db.insert(productsTable).values({
      name: item.name,
      description: item.description,
      category: item.category,
      gender: item.gender,
      productType: null,
      subType: "solid",
      sku: item.sku,
      stock: 100,
      priceInPaise: item.priceInPaise,
      modelUrl,
      thumbnailUrl: null,
      available: true,
      allowCustomization: true,
      customizationMode: item.customizationMode,
      addOns: item.addOns,
      sizes: ["S", "M", "L", "XL", "XXL"],
      defaultColor: "#1a1a1a",
      colorLabel: "Black",
    }).returning();

    console.log(`Created product #${product?.id} — ${item.name} (${item.sku})`);
  }

  console.log("Done.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
