/**
 * Endless Mountains Pride — App Configuration & Fallback Data
 *
 * Connected Google Sheet:
 * https://docs.google.com/spreadsheets/d/1u_kJb_LWM-QIZt-HL7N-EEt6_wzLPylPeCg14zezfm4/edit
 *
 * To enable live syncing in attendees' browsers, set the Google Sheet's sharing to:
 * "Anyone with the link → Viewer" (no API key or backend required).
 */

window.EMP_CONFIG = {
  DEFAULT_SHEET_ID: '1u_kJb_LWM-QIZt-HL7N-EEt6_wzLPylPeCg14zezfm4',
  TABS: {
    vendors: 'Vendors',
    schedule: 'Schedule',
    info: 'Festival Info'
  },

  // Map zones & metadata matching Mountaineer Park layout (Copy_of_2026_Festival_Map.png)
  MAP_ZONES: {
    'Main Stage': {
      category: 'events',
      subtitle: 'Central East Lawn · Performances, Speakers & DJ',
      note: 'Main rainbow stage with adjacent DJ booth and Performer Canopy directly south.'
    },
    'Performer Canopy': {
      category: 'events',
      subtitle: 'South of Main Stage',
      note: 'Shaded green-room canopy reserved for performers and stage crew.'
    },
    'emPRIDE & Drinks': {
      category: 'food',
      subtitle: 'Center Grounds · Official Festival Hub',
      note: 'Official Endless Mountains Pride merch, volunteer info, water, and cold beverages.'
    },
    'Outdoor Vendors': {
      category: 'vendors',
      subtitle: 'North-West Vendor Strip',
      note: 'Open-air outdoor vendor booths just north of Vendor Row 1–9.'
    },
    'Vendors & Face Painting': {
      category: 'vendors',
      subtitle: 'South-West Pavilion (North End)',
      note: 'Family-friendly vendor tables and all-ages festival face painting.'
    },
    'Food Court Area': {
      category: 'food',
      subtitle: 'North Grounds · Food Trucks & Seating',
      note: 'Main food court with nearby restrooms, trash stations, and festival rules board.'
    },
    'Food Tables': {
      category: 'food',
      subtitle: 'South-West Pavilion (South End)',
      note: 'Refreshment tables and shaded snacks right next to the BBQ Pit and First Aid.'
    },
    'BBQ Pit': {
      category: 'food',
      subtitle: 'South-West Fence Line',
      note: 'Freshly smoked BBQ right inside the Foot Entrance.'
    },
    'Games & Cornhole': {
      category: 'events',
      subtitle: 'North-East Lawn · Just North of Main Stage',
      note: 'Open lawn for friendly cornhole brackets and yard games.'
    },
    'Dunk Tank Area': {
      category: 'events',
      subtitle: 'Center-South Grounds (Water & Electric Hookup)',
      note: 'Community fundraiser dunk tank near the water and electric hookup.'
    },
    'Photo Booth': {
      category: 'events',
      subtitle: 'Center-West · Beside Sponsor Banner Spotlights',
      note: 'Snap festival memories by the Liberty Bell Sponsor Banner Spotlights!'
    },
    'Quiet Corner Canopy': {
      category: 'events',
      subtitle: 'South-East Shaded Canopy',
      note: 'Sensory-friendly calm zone featuring a walking labyrinth, bubble station, and art tables.'
    },
    'Main Entrance': {
      category: 'amenities',
      subtitle: 'East Gate · Adjacent to Parking & Accessible Spaces',
      note: 'Primary festival entry canopy from the large parking field. Wristbands verified here.'
    },
    'Foot Entrance': {
      category: 'amenities',
      subtitle: 'South-West Gate',
      note: 'Walk-in entrance staffed by 2 volunteers with wristbands, next to the BBQ Pit.'
    },
    'Parking Field': {
      category: 'amenities',
      subtitle: 'Large East Green Field',
      note: 'Free general parking guided by 2 parking volunteers. Accessible parking spaces are directly outside the Main Entrance. Follow north/west arrows for Cars Exit.'
    },
    'EMS & First Aid': {
      category: 'amenities',
      subtitle: '3 Medical Stations (NW EMS, Main Entrance, SW Food Tables)',
      note: 'Trained EMS crew stationed at the north-west corner, plus First Aid kits at the Main Entrance and south-west Food Tables.'
    },
    'Restrooms': {
      category: 'amenities',
      subtitle: '3 Locations (North Food Court, Mid-West, Mid-East)',
      note: 'All-gender festival restrooms available at three convenient spots around the park.'
    },
    'ATM (Bank)': {
      category: 'amenities',
      subtitle: 'Outside West Fence · Bank Next to Mountaineer Park',
      note: 'Nearest cash ATM is at the bank right beside Mountaineer Park (bring cash for tips and craft booths!).'
    },
    'Smoking Area': {
      category: 'amenities',
      subtitle: 'South-East Outside Grounds · Near Brown Jug Bar',
      note: 'Designated smoking area outside the east parking lot near Brown Jug Bar. Please keep festival grounds smoke-free.'
    }
  },

  // Built-in fallback matching the newly created Google Sheet (used offline or before sheet is set public)
  FALLBACK_DATA: {
    info: {
      'Festival Name': 'Endless Mountains Pride',
      'Festival Date': '2027-06-12',
      'Hours': '11:00 AM – 6:00 PM',
      'Venue': 'Mountaineer Park',
      'Location Subtitle': 'Endless Mountains, PA',
      'Announcement': 'Welcome to Endless Mountains Pride! Verify wristbands at the Main or Foot Entrance. Free water & shade at emPRIDE & Drinks and the Quiet Corner Canopy.',
      'Parking & Access': 'Free parking in the large east field. Accessible parking is directly beside the Main Entrance. ATM located at the bank next to Mountaineer Park.',
      'Smoking Area': 'Designated Smoking Area is located outside the east parking lot near Brown Jug Bar.',
      'Map Notice': 'Interactive map reflects our Mountaineer Park layout — booth placements and schedules update automatically from this sheet.'
    },
    vendors: [
      { name: 'Endless Mountains Pride Info & Merch', type: 'Festival Info', category: 'Apparel & Pride Gear', location: 'emPRIDE & Drinks', description: 'Official festival merch, Pride flags, cold water, soft drinks, and festival info hub.', website: 'https://endlessmountainspride.org', featured: true },
      { name: 'Susquehanna Valley PFLAG', type: 'Nonprofit', category: 'Community & Advocacy', location: 'Booth 1', description: 'Support, education, and advocacy resources for LGBTQ+ individuals, families, and allies across NEPA.', website: '@nepapflag', featured: true },
      { name: 'Pine Ridge Pottery & Clay', type: 'Vendor', category: 'Arts & Crafts', location: 'Booth 2', description: 'Hand-thrown stoneware mugs, mountain landscape planters, and rainbow glaze ceramics.', website: '@pineridgepottery', featured: false },
      { name: 'NEPA Rainbow Health Alliance', type: 'Nonprofit', category: 'Health & Wellness', location: 'Booth 3', description: 'Free affirming healthcare navigation, wellness kits, and local provider directories.', website: '', featured: true },
      { name: 'Wildflower Botanicals & Soaps', type: 'Vendor', category: 'Health & Wellness', location: 'Booth 4', description: 'Small-batch cold-process soaps, soy candles, and locally foraged herbal balms.', website: '@wildflowerbotanicalspa', featured: false },
      { name: 'Endless Mountains Youth Pride Network', type: 'Nonprofit', category: 'Community & Advocacy', location: 'Booth 5', description: 'Safe-space community group for LGBTQ+ teens and young adults with free zines and buttons.', website: '', featured: true },
      { name: 'Thread & Timber Embroidery', type: 'Vendor', category: 'Apparel & Pride Gear', location: 'Booth 6', description: 'Custom embroidered patches, bandanas, tote bags, and Pride camp-style pennants.', website: '@threadandtimber', featured: false },
      { name: 'Rural PA Legal Aid & Name Change Clinic', type: 'Nonprofit', category: 'Community & Advocacy', location: 'Booth 7', description: 'Free informational packets and Q&A on ID updates, civil rights, and local legal aid.', website: '', featured: false },
      { name: 'Prism Glassworks', type: 'Vendor', category: 'Arts & Crafts', location: 'Booth 8', description: 'Stained glass sun catchers, pride prism window hangings, and fused glass jewelry.', website: '@prismglasspa', featured: false },
      { name: 'Mountain Bark Rescue', type: 'Nonprofit', category: 'Community & Advocacy', location: 'Booth 9', description: 'Local animal shelter info table with adoptable pet profiles, treats, and dog water bowls.', website: '@mountainbarkrescue', featured: false },
      { name: 'Susquehanna Bookmobile & Indie Reads', type: 'Vendor', category: 'Local Business', location: 'Booth 10', description: 'Curated queer fiction, banned books, poetry, and children\'s picture books from local authors.', website: '@susqbookmobile', featured: true },
      { name: 'Tunkhannock Art Collective', type: 'Vendor', category: 'Arts & Crafts', location: 'Booth 11', description: 'Original prints, queer folk art stickers, watercolor postcards, and linocut tees.', website: '@tunkartcollective', featured: false },
      { name: 'Safe Harbor Counseling & Wellness', type: 'Nonprofit', category: 'Health & Wellness', location: 'Booth 12', description: 'LGBTQ+-affirming mental health resources, grounding tools, and local support group schedules.', website: '', featured: false },
      { name: 'Starlight Crochet & Plushies', type: 'Vendor', category: 'Arts & Crafts', location: 'Booth 13', description: 'Handmade Pride flag plushies, bucket hats, and soft amigurumi keepsakes.', website: '@starlightcrochet', featured: false },
      { name: 'Endless Mountains Watershed Friends', type: 'Nonprofit', category: 'Community & Advocacy', location: 'Booth 14', description: 'Trail maps, queer hiking club signups, and native wildflower seed packets.', website: '', featured: false },
      { name: 'Copper & Quartz Jewelry', type: 'Vendor', category: 'Apparel & Pride Gear', location: 'Booth 15', description: 'Handcrafted hammered brass, silver, and rainbow fluorite necklaces and earrings.', website: '@copperquartzpa', featured: false },
      { name: 'Local Makers Tie-Dye Co.', type: 'Vendor', category: 'Apparel & Pride Gear', location: 'Booth 16', description: 'Vibrant ice-dyed shirts, hoodies, and festival tapestries in Progress Pride palettes.', website: '@localmakerstiedye', featured: false },
      { name: 'County Library Outreach', type: 'Nonprofit', category: 'Family & Activities', location: 'Booth 17', description: 'Free library card signups, summer reading kits, and Pride bookmark crafting.', website: '', featured: false },
      { name: 'Mountain Meadow Plant Co.', type: 'Vendor', category: 'Local Business', location: 'Outdoor Vendors', description: 'Outdoor potted perennials, hanging baskets, succulents, and painted terracotta pots.', website: '@mountainmeadowplants', featured: false },
      { name: 'Rainbow Brush Face Painting', type: 'Vendor', category: 'Family & Activities', location: 'Vendors & Face Painting', description: 'All-ages glitter designs, rainbow cheek art, and temporary festival tattoos.', website: '', featured: true },
      { name: 'Endless Mountains Smokehouse BBQ', type: 'Food & Drink', category: 'Food & Beverage', location: 'BBQ Pit', description: 'Pulled pork, smoked jackfruit sandwiches, mac & cheese, and cornbread fresh off the pit.', website: '', featured: true },
      { name: 'Summit Street Food Trucks', type: 'Food & Drink', category: 'Food & Beverage', location: 'Food Court Area', description: 'Rotating local favorites: wood-fired pizza, empanadas, loaded fries, and vegan wraps.', website: '', featured: true },
      { name: 'Sweet Trails Lemonade & Kettle Corn', type: 'Food & Drink', category: 'Food & Beverage', location: 'Food Tables', description: 'Fresh-squeezed strawberry basil lemonade, iced cold brew, and warm rainbow kettle corn.', website: '', featured: false }
    ],
    schedule: [
      { name: 'Gates Open & Welcome DJ Set', startTime: '11:00 AM', endTime: '11:30 AM', location: 'Main Stage', category: 'Live Music', description: 'Grab your wristband at the Main or Foot Entrance, explore vendor rows, and kick off the day with upbeat Pride anthems.', host: 'DJ Solstice' },
      { name: 'Opening Ceremony & Land Acknowledgment', startTime: '11:30 AM', endTime: '12:00 PM', location: 'Main Stage', category: 'Speakers & Community', description: 'Welcome remarks from Endless Mountains Pride board members, community proclamations, and sponsor recognition.', host: 'EMP Board & Local Leaders' },
      { name: 'Sensory-Friendly Storytime & Bubble Garden', startTime: '12:00 PM', endTime: '12:45 PM', location: 'Quiet Corner Canopy', category: 'Family & Youth', description: 'Relaxed, welcoming picture-book readings, giant bubbles, and shaded art tables for kids and families.', host: 'County Library & Youth Pride' },
      { name: 'Acoustic Folk Showcase', startTime: '12:15 PM', endTime: '1:00 PM', location: 'Main Stage', category: 'Live Music', description: 'Original indie-folk and Appalachian roots songs celebrating rural queer joy.', host: 'Cedar & Wren' },
      { name: 'Festival Cornhole Tournament', startTime: '1:00 PM', endTime: '2:15 PM', location: 'Games & Cornhole', category: 'Games & Activities', description: 'Friendly doubles bracket — sign up at the boards 15 minutes early! Prizes from local vendors.', host: 'Volunteer Crew' },
      { name: 'Afternoon Drag Extravaganza (Act I)', startTime: '1:15 PM', endTime: '2:15 PM', location: 'Main Stage', category: 'Drag & Performance', description: 'High-energy drag showcase featuring regional kings, queens, and nonbinary royalty. Bring dollar bills to tip!', host: 'Hosted by Aurora Pines' },
      { name: 'Community Dunk Tank Challenge', startTime: '2:00 PM', endTime: '3:30 PM', location: 'Dunk Tank Area', category: 'Games & Activities', description: 'Step up and dunk willing community volunteers and local allies — all proceeds support Endless Mountains Pride!', host: 'Community Volunteers' },
      { name: 'Mindful Labyrinth Walk & Collage Workshop', startTime: '2:15 PM', endTime: '3:15 PM', location: 'Quiet Corner Canopy', category: 'Family & Youth', description: 'Take a quiet breather in the shaded canopy with a guided labyrinth walk and Pride zine-making station.', host: 'Safe Harbor Wellness' },
      { name: 'Pride Portrait Hour', startTime: '2:30 PM', endTime: '3:30 PM', location: 'Photo Booth', category: 'Games & Activities', description: 'Free candid portraits and group snapshots in front of the Sponsor Banner & Liberty Bell backdrop.', host: 'Volunteer Photographers' },
      { name: 'Youth & Ally Open Mic', startTime: '3:00 PM', endTime: '3:45 PM', location: 'Main Stage', category: 'Speakers & Community', description: 'Poetry, acoustic songs, and personal stories shared by local LGBTQ+ youth and community members.', host: 'Youth Pride Network' },
      { name: 'Headliner Band: The Pinecones', startTime: '4:00 PM', endTime: '4:50 PM', location: 'Main Stage', category: 'Live Music', description: 'Upbeat synth-pop and dance rock straight from NEPA to get the whole lawn moving.', host: 'The Pinecones' },
      { name: 'Grand Finale Drag Show & Raffle Drawing', startTime: '5:00 PM', endTime: '5:50 PM', location: 'Main Stage', category: 'Drag & Performance', description: 'Our show-stopping closing drag set plus live winner announcements for the community raffle!', host: 'Aurora Pines & Cast' },
      { name: 'Closing Dance Party & Farewell', startTime: '5:50 PM', endTime: '6:00 PM', location: 'Main Stage', category: 'Live Music', description: 'One last collective dance together before wrapping up an unforgettable Endless Mountains Pride!', host: 'DJ Solstice' }
    ]
  }
};
