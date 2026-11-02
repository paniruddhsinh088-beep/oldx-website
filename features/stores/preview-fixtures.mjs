// Synthetic authored content only. No real sellers, contacts, media or accounts.
export const sampleStores = Object.freeze([
  Object.freeze({ id: 'demo-shop', name: 'કિરણનું ઘર · Kiran Home', city: 'અમદાવાદ',
    description: 'ઘર માટે ઉપયોગી વસ્તુઓ · घर के लिए उपयोगी सामान · Things for home' }),
  Object.freeze({ id: 'demo-empty', name: 'નવું નમૂના સ્ટોર · New sample shop', city: 'અમદાવાદ', description: '' })
]);
const titles = [
  ['ખુરશી · Chair', 'furniture', 1200], ['લાકડાનું ટેબલ', 'furniture', 4500],
  ['किताबों का सेट', 'books', 250], ['Reading lamp', 'electronics', 800],
  ['મોબાઇલ સ્ટેન્ડ', 'mobiles', 150], ['ઘડિયાળ · Clock', 'electronics', 650],
  ['બુકશેલ્ફ', 'furniture', 3200], ['School books', 'books', 400],
  ['टेबल लैंप', 'electronics', 950], ['Office chair', 'furniture', 2600],
  ['કવર · Phone cover', 'mobiles', 200], ['કોફી ટેબલ', 'furniture', 1800],
  ['ગુજરાતી વાર્તાઓ', 'books', 300]
];
export const sampleListings = Object.freeze(titles.map(([title, category, basePrice], index) => Object.freeze({
  id: 'sample-' + (index + 1), sellerUid: 'demo-shop', title, category, basePrice,
  isSold: index % 4 === 1, createdAt: Object.freeze({ seconds: 1700000000 + index, nanoseconds: 0 })
})));

// Public category copy for the synthetic share card, not a live Store schema.
export const sampleStoreCardCategories = Object.freeze({ 'demo-shop': Object.freeze(['furniture','books','electronics','mobiles']), 'demo-empty': Object.freeze([]) });
