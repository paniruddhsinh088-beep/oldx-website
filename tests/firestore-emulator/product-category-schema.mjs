export const PRODUCT_CATEGORIES = {
  cars: ["Cars / 4 Wheelers"],
  properties: ["For Sale: Houses & Apartments", "For Rent: Houses & Apartments", "Lands & Plots", "For Rent: Shops & Offices", "PG & Guest Houses"],
  mobiles: ["Mobile Phones", "Accessories", "Tablets"],
  bikes: ["Motorcycles", "Scooters", "Spare Parts", "Bicycles"],
  electronics: ["TVs, Video - Audio", "Kitchen & Other Appliances", "Computers & Laptops", "Cameras & Lenses", "Games & Entertainment", "Fridges", "Computer Accessories", "Hard Disks, Printers & Monitors", "ACs", "Washing Machines"],
  commercial: ["Commercial & Other Vehicles", "Spare Parts"],
  furniture: ["Sofa & Dining", "Beds & Wardrobes", "Home Decor & Garden", "Kids Furniture", "Other Household Items"],
  fashion: ["Men", "Women", "Kids"],
  books: ["Books", "Gym & Fitness", "Musical Instruments", "Sports Equipment", "Other Hobbies"],
  pets: ["Dogs", "Pet Food & Accessories", "Other Pets"],
  jobs: ["Data Entry & Back Office", "Sales & Marketing", "BPO & Telecaller", "Driver", "Office Assistant", "Teacher"],
  services: ["Education & Classes", "Tours & Travel", "Electronics Repair & Services", "Health & Beauty", "Home Renovation & Repair", "Cleaning & Pest Control", "Legal & Documentation Services", "Packers & Movers", "Other Services"]
};

const CAR_BRANDS = new Set(["Maruti Suzuki", "Hyundai", "Tata", "Mahindra", "Honda", "Toyota", "Other"]);

function clean(value, max) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.length > max || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text)) return null;
  return text;
}

export function validateProductCategory(category, subCategory) {
  return Object.hasOwn(PRODUCT_CATEGORIES, category) &&
    typeof subCategory === "string" &&
    PRODUCT_CATEGORIES[category].includes(subCategory);
}

/** Returns an allowlisted public attribute object or null when invalid. */
export function projectPublicAttributes(category, input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const keys = Object.keys(input);
  if (category === "cars") {
    if (keys.some(key => !["brand", "model"].includes(key))) return null;
    const brand = clean(input.brand, 40);
    const model = clean(input.model, 80);
    if (!brand || !CAR_BRANDS.has(brand) || !model) return null;
    return { brand, model };
  }
  if (!Object.hasOwn(PRODUCT_CATEGORIES, category)) return null;
  if (keys.some(key => key !== "type")) return null;
  const type = clean(input.type, 120);
  return type ? { type } : null;
}
