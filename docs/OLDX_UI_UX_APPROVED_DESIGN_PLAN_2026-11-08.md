# OLDX Website અને Android App — મંજૂર UI/UX Design Plan

**મંજૂરી તારીખ:** 2026-11-08  
**સ્થિતિ:** OWNER-APPROVED DESIGN DIRECTION — source/design work only; **production/staging launch HOLD / NO-GO**  
**Repository:** `paniruddhsinh088-beep/oldx-website`  
**Authorized branch:** `security-hardening-review`  
**મુખ્ય સિદ્ધાંત:** હાલના UI, routes, components, forms, backend adapters અને testsનો **મહત્તમ ફરી ઉપયોગ**; મોટા rewrite, વધારાનો ખર્ચ કે લાંબી design પ્રક્રિયા ટાળવી.

આ દસ્તાવેજ માલિકે સંપૂર્ણ વાંચીને મંજૂર કરેલી OLDX Website/Android App design અને user-experience રૂપરેખા નોંધે છે. આ મંજૂરી **design direction માટે છે, deployment, billing, IAM, production data, Firebase Rules અથવા live activation માટે નથી**. Mockupનાં ઉદાહરણરૂપ ઉત્પાદનો, ratings અને આંકડાઓને live feature/evidence તરીકે ન માનવાં.

## 1. મુખ્ય ઉદ્દેશ અને પ્રાથમિકતા
- સામાન્ય વ્યક્તિ કોઈની મદદ વગર OLDXમાં Product શોધી, જોઈ, વેચવા મૂકી, Store/Service Provider શોધી અને યોગ્ય seller/providerને સંપર્ક કરી શકે.
- ગુજરાતીમાં પણ સહેલું, વિશ્વાસપાત્ર, ઝડપી, mobile-first અને ઓછા internet/data વપરાશવાળું અનુભવ.
- આકર્ષક દેખાવ મહત્વનું, પરંતુ **સરળ ઉપયોગ → સુરક્ષા/વિશ્વાસ → ઝડપ → આધુનિક દેખાવ → ઓછો ફેરફાર/સમય/ખર્ચ** પ્રાથમિકતા.
- જૂનું કામ અને સંમત સુવિધાઓ બગાડવી નહીં; demo/disabled featuresને operational ન બતાવવાં.

## 2. રંગો અને એકરૂપ Design System
- મુખ્ય ઓળખ: **Blue–White–Orange**. Blue માટે logo/header/links, White માટે સ્વચ્છ background, Orange માટે Sell (+) અને ખાસ primary actions.
- Light Greyથી sections/cards અલગ; Green ફક્ત હકીકત આધારિત success/availability/verification state માટે.
- Fonts, icons, spacing, contrast, radius, shadows, focus indicators અને tap targets બધાં પેજમાં એકસરખાં.
- હાલની CSS/styles અને components reuse. નવી heavy design library કે animation engine નહીં; accessible contrast અને 200% text zoom જાળવો.

## 3. Homepage: ઓછો Banner, વધુ Products
ઉપરથી નીચે ગોઠવણી:
1. OLDX Logo, પસંદ કરેલું Location, Notifications (અને સુલભ ભાષા/Profile controls).
2. એક સ્પષ્ટ Search Bar; હાલનું Location, distance/filter અને Voice Search જ્યાં ઉપલબ્ધ હોય ત્યાં જાળવો.
3. **નાનું, હળવું Banner** — મોટી hero/slider/videoને કારણે products નીચે ધકેલાય નહીં.
4. ઓળખી શકાય તેવા compact Category icons/labels.
5. **નજીકની/નવી Products**: પહેલી mobile viewportમાં search, કેટલીક categories અને product cardsની શરૂઆત દેખાય તે લક્ષ્ય.
6. યોગ્ય જગ્યાએ Stores અને Local Services discovery.

Bannerનું સ્વરૂપ promotional હોય તો પણ product discoveryને પ્રાથમિકતા. Heavy auto-rotating sliders, autoplay video અને duplicate controls નહીં.

## 4. Categories
- Car, Mobile, Bike, Property/House, Store, Services, Furniture, Fashion વગેરે; હાલની તમામ agreed categories દૂર ન કરવી.
- Mobile પર વાંચી શકાય તેવા ટૂંકા labels + સ્પષ્ટ icons; વધુ categories માટે હાલના 'More' / complete category list માર્ગ.
- Tap targets સહેલા, vertical space compact; category પસંદ કરતાં હાલનું query/filter state યોગ્ય રીતે apply થાય.
- Existing category data, i18n અને filtering logic ફરીથી વાપરવું; hard-coded અલગ taxonomy ન બનાવવી.

## 5. Product Cards અને Listing
- એકસરખું image frame/aspect ratio; `object-fit`ના યોગ્ય ઉપયોગથી ફોટા વિકૃત ન થાય.
- Cardમાં માત્ર ફોટો, ટૂંકું product name, **મોટી bold price**, location/ઉપલબ્ધ distance, Heart/Favorite, જરૂર હોય તો condition badge.
- Long descriptions/details અને seller privacy-sensitive data Cardમાં નહીં; tap → product detail.
- Images lazy load, placeholders, broken image recovery; existing image/privacy/auth checks નબળાં ન પાડવા.
- Responsive mobile cards (યોગ્ય જગ્યાએ બે columns), large-text/320px પર overflow નહીં.

## 6. Mobile Bottom Navigation / Desktop Navigation
મોબાઇલમાં પાંચ સ્પષ્ટ મુખ્ય destinations:
1. **Home** — home / nearby recommendations.
2. **Search** — products, stores, services શોધ/filters.
3. **Sell (+)** — વચ્ચે Orange prominent action.
4. **Chat** — private conversations / enquiries.
5. **Profile** — My Ads, My Store, services, Saved Items, languages/settings.

- દરેક destinationમાં icon સાથે વાંચી શકાય તેવું નામ; active destination સ્પષ્ટ.
- Desktop પર હાલના header/navigation સાથે એ જ સુવિધા; અલગ codebase નહીં.
- Fixed bottom bar keyboard, safe-area, forms, chat composer, scrolling અને modalsને ઢાંકે નહીં.
- Existing routers, deep links, authentication/session and browser back/Android back behavior reuse; needless rewrite નહીં.
- Navigation implementation પહેલાં source audit: હાલના entry points અને accessibility સાચવવાં.

## 7. Sell (+) / Login
Sell (+) દબાવતાં **વસ્તુ વેચો / Store બનાવો / સેવા આપો** ત્રણ સરળ વિકલ્પ.
- દરેક પસંદગી હાલના હાજર Product form, Store creator અથવા Provider registration તરફ દોરી જાય; નવા duplicate forms નહીં.
- Guest products/services જોઈ શકે; listing, saved item અથવા private chat જેવી સુરક્ષિત ક્રિયાઓ માટે Login જરૂરી હોય ત્યારે Login prompt.
- Login પછી શક્ય હોય ત્યાં userની અગાઉની પસંદ કરેલી ક્રિયા ફરી ચાલુ કરી શકાય; sensitive session data browserમાં expose નહીં.

## 8. Product Detail
- મોટા photo gallery, નામ, price, condition, description, location અને Google Maps link, seller/storeની જરૂરી જાહેર માહિતી.
- મુખ્ય action **Chat with Seller**; permission/consent હોય તો જ Call/Contact.
- Share, Favorite અને seller safety controls સ્પષ્ટ. જૂના feature contracts જાળવવા.
- OLDX C2C classifieds છે; **Add to Cart/Checkout**ને default designમાં ન ઉમેરવું.

## 9. Stores
- Store discoveryમાં search/category/location અને compact cards.
- Details: Store photo/name, consented address/map, product catalogue, gallery, Share, approved contact.
- Store sellerની mini-website જેવું; existing catalogue, pagination, shareable cards, revocation/async controls reuse.
- Unpublished/private store data public ન બતાવવું.

## 10. Service Providers
- City/area/service filters; provider cardમાં name/photo, service labels, city, applicable verified availability, rating **ફક્ત ખરેખર મંજૂર reviews હોય તો**.
- Detailમાં multi-service list, gallery, buyer enquiries, chat, share અને પાત્ર buyer-only reviews.
- Fake/demo ratings, contact, completion કે availabilityને live કહીને ન બતાવવું.
- હાલની provider discovery/detail/inbox/pagination અને guarded transaction adapters reuse.

## 11. Chat અને Enquiries
- ઓળખાય તેવો simple message layout, unread conversations prominent, clear composer/send, bounded history.
- Keyboard overlap નહીં, typing/status/retry અને block/delete/privacy controls હાલના contract પ્રમાણે જાળવો.
- Firebase verified participant/ownership, rate limits, retention, revocation/permissionsનું પાલન.
- Browser/UI mock actionને actual sent/persisted message ન ગણવો.

## 12. Profile, Saved Items અને Settings
- My Ads, My Store, My Services, Saved Products, Notifications, Language, Account/Privacy, Help, Logout.
- Secondary settingsને groupingમાં રાખવા; main screen પર બિનજરૂરી ભીડ નહીં.
- માત્ર સાચી authorization પરથી data; Admin interface અલગ અને સુરક્ષિત.

## 13. ભાષા
- શરૂઆત: Gujarati (`gu`), English (`en`), Hindi (`hi`).
- First-use language selector અને Profile/Settingsમાં બદલવાની વ્યવસ્થા; preference restore.
- Essential nav/forms/errors/buttonsનું યોગ્ય ભાષાંતર; લાંબાં labels માટે responsive flexibility.
- User-generated product descriptions અને private messagesનું અનધિકૃત automatic translation નહીં.
- Native-speaking review બાકી હોવાથી ત્રણે ભાષામાં browser/mobile regression જરૂરી.

## 14. Website + Android code reuse
- Shared responsive web frontend; Android માટે Capacitorથી pack કરવું.
- Camera, location, native share, notification, back/deep links/safe-area માટે ફક્ત જરૂરી platform-specific hooks.
- Android-ready UI જાળવવી; અલગથી સંપૂર્ણ Android redesign નહીં.

## 15. અમલીકરણનો ઓછા ફેરફારવાળો ક્રમ
**Phase A — visual polish, minimal risk:** banner height, spacing, category size, product card photo/price, search/location readability, shared CSS tokens. Reuse existing markup/styles and regression tests.  
**Phase B — main navigation:** source audit પછી પાંચ bottom actionsને existing routes, session, chat/profile અને back/keyboard interactions સાથે incrementally connect.  
**Phase C — remaining journeys:** Product detail, Stores, Services, Chat, Profile, Adminમાં same visual design tokens; meaningful accessibility/recovery tests.  
**Phase D — real-user usability:** 5–10 સામાન્ય usersને Product search, price/location, Sell, Chat, Store/Provider અને language change અજમાવવું; જ્યાં અટકે ત્યાં નાનાં fixes.

Design implementation પહેલાં current UI + proposed wireframesની સરખામણી; મોટા mockup redesign માટે દિવસો ન ખર્ચવા. Source-only and isolated tests first. Staging/production deployment requires separate approval.

## 16. નહીં કરવાના ફેરફારો
- Working website rewrite, framework migration, unnecessary backend/database/schema changes.
- New heavy UI library, autoplay videos, bloated animations, repeated popups અથવા giant sliders.
- Products, Store, Service, Chat, Admin, Photos, Security, Moderation, Localization કે Android requirements દૂર કરવી નહીં.
- Attractive mockupsના fake products/reviews/numbersને production data ગણવું નહીં.
- Private chat/photo publicationનું trust boundary નબળું પાડવું નહીં.

## 17. Usability acceptance
5–10 સામાન્ય લોકો પાસે સ્વતંત્ર રીતે 6 કાર્યો કરાવો: product શોધવું; price/location સમજવું; ad post રસ્તો શોધવો; seller chat શોધવું; store/provider શોધવું; language switch.  
Track where they hesitate, mis-tap, cannot back out, lose input or cannot understand. Fix only observed confusion, plus security/accessibility defects. Test 320px / 375px / 200% text, keyboard, screenreader labels, low-end device, Gujarati/Hindi/English. Do not claim universal appeal without testing.

## 18. Coding, speed, safety, cost
- Maximum use of current OLDX components, routes, test suites, translations, adapters and shared code; minimal coherent reversible diffs.
- Maintain features and data contracts; no change merely for trendy looks.
- Avoid extra paid dependencies, excessive requests, heavy images and animations.
- Run targeted Node/browser/mobile/locale tests; compare before/after UX and load/performance.
- Commit only to `security-hardening-review`; keep unrelated changes safe.
- No production deployment, no live Firebase/Rules/IAM/secrets/billing change without separate explicit authorization.

## Final owner decision
**Approved:** Blue–White–Orange mobile-first identity; **small banner + more visible products**; clearer compact categories/search; consistent clean product cards with visible price/location/favorite; navigation Home/Search/Orange Sell(+)/Chat/Profile; accessible authenticated actions, shared responsive web/Capacitor design; reuse-first incremental work; no heavy redesign; usability testing before production.

**Not authorized by this document:** Cloudflare/Vercel/Firebase/Cloud Run production or staging deployment, Blaze/billing activation, IAM/Secrets, changes to live data/Rules, domain cutover or public launch. Release state remains **HOLD / NO-GO** until separate security and acceptance approval.
