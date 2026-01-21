-- =====================================================
-- LONDON TEST BATCH - 10 Venues
-- Premium Listings for testing
-- Run this SQL after confirming the format is correct
-- =====================================================

-- -----------------------------------------------------
-- 1. British Museum
-- -----------------------------------------------------
INSERT INTO posts (post_key, member_id, member_name, subcategory_key, loc_qty, visibility, moderation_status, checkout_key, payment_status, expires_at, created_at, updated_at)
VALUES ('the-british-museum', 2, 'UrbanExplorer', 'venues', 1, 'active', 'clean', 'premium-listing', 'paid', NULL, NOW(), NOW());
SET @post_id_1 = LAST_INSERT_ID();

INSERT INTO post_media (member_id, post_id, file_name, file_url, file_size, created_at, updated_at)
VALUES (2, @post_id_1, CONCAT(@post_id_1, '-bm01a1.jpg'), CONCAT('https://cdn.funmap.com/post-images/2026-01/', @post_id_1, '-bm01a1.jpg'), 8500000, NOW(), NOW());
SET @media_id_1 = LAST_INSERT_ID();

INSERT INTO post_map_cards (
  post_id, subcategory_key, title, description, media_ids,
  public_email, phone_prefix, public_phone,
  venue_name, address_line, city, latitude, longitude, country_code,
  website_url, created_at, updated_at
) VALUES (
  @post_id_1, 'venues', 'The British Museum',
  'The British Museum stands as one of the world''s most comprehensive museums dedicated to human history, art, and culture. Located in the Bloomsbury district of London, the museum houses a permanent collection of approximately eight million works, making it one of the largest and most extensive collections in existence. The museum was established in 1753 and first opened to the public in 1759, operating from its current location on Great Russell Street since 1857.

The museum''s collection spans over two million years of human history and includes iconic artifacts such as the Rosetta Stone, the Elgin Marbles from the Parthenon, and Egyptian mummies that draw millions of visitors annually. The architecture itself is noteworthy, featuring the Great Court designed by Norman Foster - a stunning glass-roofed courtyard that serves as the largest covered public square in Europe.

Admission to the British Museum is free, though donations are welcomed. The museum offers both permanent galleries and rotating special exhibitions throughout the year. Visitors can explore collections organized by region and era, including Ancient Egypt, Ancient Greece and Rome, Asia, and the Middle East. Audio guides and guided tours are available for those seeking deeper context about the collections.

Photo: Dale Cruse (CC BY 2.0)',
  CONCAT(@media_id_1),
  'information@britishmuseum.org', '+44', '20 7323 8299',
  'The British Museum', 'Great Russell St, London WC1B 3DG, UK', 'London',
  51.5194133, -0.1269566, 'GB',
  'https://www.britishmuseum.org',
  NOW(), NOW()
);

-- -----------------------------------------------------
-- 2. Natural History Museum
-- -----------------------------------------------------
INSERT INTO posts (post_key, member_id, member_name, subcategory_key, loc_qty, visibility, moderation_status, checkout_key, payment_status, expires_at, created_at, updated_at)
VALUES ('natural-history-museum-london', 3, 'VibeHunter_Melb', 'venues', 1, 'active', 'clean', 'premium-listing', 'paid', NULL, NOW(), NOW());
SET @post_id_2 = LAST_INSERT_ID();

INSERT INTO post_media (member_id, post_id, file_name, file_url, file_size, created_at, updated_at)
VALUES (3, @post_id_2, CONCAT(@post_id_2, '-nhm02b2.jpg'), CONCAT('https://cdn.funmap.com/post-images/2026-01/', @post_id_2, '-nhm02b2.jpg'), 6140000, NOW(), NOW());
SET @media_id_2 = LAST_INSERT_ID();

INSERT INTO post_map_cards (
  post_id, subcategory_key, title, description, media_ids,
  public_email, phone_prefix, public_phone,
  venue_name, address_line, city, latitude, longitude, country_code,
  website_url, created_at, updated_at
) VALUES (
  @post_id_2, 'venues', 'Natural History Museum',
  'The Natural History Museum in London is one of the world''s foremost centres for natural science research and home to an extraordinary collection of over 80 million specimens. Located in the South Kensington district, the museum occupies a magnificent Romanesque-style building designed by Alfred Waterhouse, which opened in 1881. The building itself is a masterpiece of Victorian architecture, featuring terracotta tiles depicting plants and animals throughout its facade and interior.

The museum''s collection includes specimens collected by Charles Darwin and continues to be an active research institution where hundreds of scientists work on projects ranging from biodiversity to planetary science. The iconic Hintze Hall, formerly dominated by the beloved Diplodocus skeleton nicknamed "Dippy," now showcases a spectacular blue whale skeleton suspended from the ceiling, representing the museum''s shift toward highlighting living species and conservation.

Entry to the permanent galleries is free, with special exhibitions requiring tickets. The museum offers extensive educational programs, behind-the-scenes tours, and interactive experiences for visitors of all ages. Popular exhibits include the dinosaur gallery, the vault of rare gems and minerals, and the wildlife garden that provides a green oasis in the heart of London.

Photo: Chiuchihmin (CC BY-SA 3.0)',
  CONCAT(@media_id_2),
  'feedback@nhm.ac.uk', '+44', '20 7942 5000',
  'Natural History Museum', 'Cromwell Road, London SW7 5BD, UK', 'London',
  51.496715, -0.176367, 'GB',
  'https://www.nhm.ac.uk',
  NOW(), NOW()
);

-- -----------------------------------------------------
-- 3. Tower of London
-- -----------------------------------------------------
INSERT INTO posts (post_key, member_id, member_name, subcategory_key, loc_qty, visibility, moderation_status, checkout_key, payment_status, expires_at, created_at, updated_at)
VALUES ('tower-of-london', 4, 'SydneyFoodie', 'venues', 1, 'active', 'clean', 'premium-listing', 'paid', NULL, NOW(), NOW());
SET @post_id_3 = LAST_INSERT_ID();

INSERT INTO post_media (member_id, post_id, file_name, file_url, file_size, created_at, updated_at)
VALUES (4, @post_id_3, CONCAT(@post_id_3, '-tol03c3.jpg'), CONCAT('https://cdn.funmap.com/post-images/2026-01/', @post_id_3, '-tol03c3.jpg'), 4500000, NOW(), NOW());
SET @media_id_3 = LAST_INSERT_ID();

INSERT INTO post_map_cards (
  post_id, subcategory_key, title, description, media_ids,
  public_email, phone_prefix, public_phone,
  venue_name, address_line, city, latitude, longitude, country_code,
  website_url, created_at, updated_at
) VALUES (
  @post_id_3, 'venues', 'Tower of London',
  'The Tower of London, officially Her Majesty''s Royal Palace and Fortress of the Tower of London, stands as one of England''s most iconic historical landmarks. Founded in 1066 as part of the Norman Conquest, the fortress has served variously as a royal residence, prison, armoury, treasury, and even a zoo. The central White Tower, which gives the entire castle its name, was built by William the Conqueror in 1078 and remains one of the finest examples of Norman military architecture in the country.

The Tower is perhaps best known for its role as a notorious prison and execution site, having held famous prisoners including Anne Boleyn, Sir Walter Raleigh, and Guy Fawkes. Today, the Tower houses the Crown Jewels of England, one of the world''s most valuable collections of ceremonial regalia, which remains a working collection used by the Royal Family for state occasions. The iconic Yeoman Warders, known as "Beefeaters," have guarded the Tower since Tudor times and now serve as tour guides sharing centuries of history.

The Tower is a UNESCO World Heritage Site and welcomes millions of visitors annually. Don''t miss the legendary ravens - according to legend, if they ever leave the Tower, the kingdom will fall. Guided tours by Yeoman Warders are included with admission and offer entertaining and informative walks through nearly a thousand years of British history.

Photo: Interfase (CC BY-SA 4.0)',
  CONCAT(@media_id_3),
  'visitorServices.TOL@hrp.org.uk', '+44', '20 3166 6000',
  'Tower of London', 'London EC3N 4AB, UK', 'London',
  51.508530, -0.076132, 'GB',
  'https://www.hrp.org.uk/tower-of-london',
  NOW(), NOW()
);

-- -----------------------------------------------------
-- 4. Westminster Abbey
-- -----------------------------------------------------
INSERT INTO posts (post_key, member_id, member_name, subcategory_key, loc_qty, visibility, moderation_status, checkout_key, payment_status, expires_at, created_at, updated_at)
VALUES ('westminster-abbey', 5, 'LondonGigGuide', 'venues', 1, 'active', 'clean', 'premium-listing', 'paid', NULL, NOW(), NOW());
SET @post_id_4 = LAST_INSERT_ID();

INSERT INTO post_media (member_id, post_id, file_name, file_url, file_size, created_at, updated_at)
VALUES (5, @post_id_4, CONCAT(@post_id_4, '-wab04d4.jpg'), CONCAT('https://cdn.funmap.com/post-images/2026-01/', @post_id_4, '-wab04d4.jpg'), 13000000, NOW(), NOW());
SET @media_id_4 = LAST_INSERT_ID();

INSERT INTO post_map_cards (
  post_id, subcategory_key, title, description, media_ids,
  public_email, phone_prefix, public_phone,
  venue_name, address_line, city, latitude, longitude, country_code,
  website_url, created_at, updated_at
) VALUES (
  @post_id_4, 'venues', 'Westminster Abbey',
  'Westminster Abbey, formally titled the Collegiate Church of Saint Peter at Westminster, is one of Britain''s most significant religious buildings and a masterpiece of medieval Gothic architecture. Founded in 960 AD and rebuilt in the Gothic style between 1245 and 1272, the Abbey has been the coronation church for English and British monarchs since 1066 and has hosted seventeen royal weddings, including the marriage of Prince William and Catherine Middleton in 2011.

The Abbey serves as the final resting place for over 3,300 notable figures, including seventeen monarchs, poets such as Geoffrey Chaucer and Charles Dickens in Poets'' Corner, and scientists including Isaac Newton, Charles Darwin, and Stephen Hawking. The Henry VII Lady Chapel, completed in 1519, is considered one of the finest examples of late Perpendicular Gothic architecture, featuring an extraordinary fan vault ceiling that appears to defy gravity.

Westminster Abbey continues to function as an active church holding daily services while welcoming over one million visitors annually. Audio guides are available in multiple languages, and verger-led tours offer deeper insights into the Abbey''s history and architecture. The Abbey''s Cloisters and Chapter House, along with the Queen''s Diamond Jubilee Galleries located high above the nave, provide additional spaces to explore this UNESCO World Heritage Site.

Photo: Wikimedia Commons (CC BY 2.0)',
  CONCAT(@media_id_4),
  'info@westminster-abbey.org', '+44', '20 7222 5152',
  'Westminster Abbey', '20 Dean''s Yard, London SW1P 3PA, UK', 'London',
  51.4993619, -0.1273998, 'GB',
  'https://www.westminster-abbey.org',
  NOW(), NOW()
);

-- -----------------------------------------------------
-- 5. Tate Modern
-- -----------------------------------------------------
INSERT INTO posts (post_key, member_id, member_name, subcategory_key, loc_qty, visibility, moderation_status, checkout_key, payment_status, expires_at, created_at, updated_at)
VALUES ('tate-modern', 6, 'NYCVenueSpotter', 'venues', 1, 'active', 'clean', 'premium-listing', 'paid', NULL, NOW(), NOW());
SET @post_id_5 = LAST_INSERT_ID();

INSERT INTO post_media (member_id, post_id, file_name, file_url, file_size, created_at, updated_at)
VALUES (6, @post_id_5, CONCAT(@post_id_5, '-ttm05e5.jpg'), CONCAT('https://cdn.funmap.com/post-images/2026-01/', @post_id_5, '-ttm05e5.jpg'), 12200000, NOW(), NOW());
SET @media_id_5 = LAST_INSERT_ID();

INSERT INTO post_map_cards (
  post_id, subcategory_key, title, description, media_ids,
  public_email, phone_prefix, public_phone,
  venue_name, address_line, city, latitude, longitude, country_code,
  website_url, created_at, updated_at
) VALUES (
  @post_id_5, 'venues', 'Tate Modern',
  'Tate Modern is Britain''s national gallery of international modern and contemporary art, housed in the former Bankside Power Station on the south bank of the River Thames. Opened in 2000, the gallery transformed the industrial building designed by Sir Giles Gilbert Scott into one of the world''s most visited modern art museums. The dramatic Turbine Hall, the building''s former engine room, serves as a vast entrance space that hosts monumental commissioned artworks and installations.

The collection spans from 1900 to the present day and includes major works by artists such as Pablo Picasso, Salvador Dalí, Andy Warhol, Mark Rothko, and Louise Bourgeois. The displays are arranged thematically rather than chronologically, encouraging visitors to make connections across different periods and movements. In 2016, the Switch House extension (now the Blavatnik Building) added ten floors of gallery space, including a spectacular viewing platform offering panoramic views across London.

Entry to the permanent collection is free, with special exhibitions requiring tickets. The gallery is connected to St Paul''s Cathedral on the opposite bank by the Millennium Bridge, making it easy to combine visits. Multiple restaurants, cafes, and an excellent art bookshop complement the visitor experience, while late openings on Fridays and Saturdays allow for evening cultural outings.

Photo: Wikimedia Commons (CC BY-SA 4.0)',
  CONCAT(@media_id_5),
  'visiting.modern@tate.org.uk', '+44', '20 7887 8888',
  'Tate Modern', 'Bankside, London SE1 9TG, UK', 'London',
  51.507594, -0.099351, 'GB',
  'https://www.tate.org.uk/visit/tate-modern',
  NOW(), NOW()
);

-- -----------------------------------------------------
-- 6. Buckingham Palace
-- -----------------------------------------------------
INSERT INTO posts (post_key, member_id, member_name, subcategory_key, loc_qty, visibility, moderation_status, checkout_key, payment_status, expires_at, created_at, updated_at)
VALUES ('buckingham-palace', 7, 'ParisCulture', 'venues', 1, 'active', 'clean', 'premium-listing', 'paid', NULL, NOW(), NOW());
SET @post_id_6 = LAST_INSERT_ID();

INSERT INTO post_media (member_id, post_id, file_name, file_url, file_size, created_at, updated_at)
VALUES (7, @post_id_6, CONCAT(@post_id_6, '-bkp06f6.jpg'), CONCAT('https://cdn.funmap.com/post-images/2026-01/', @post_id_6, '-bkp06f6.jpg'), 4200000, NOW(), NOW());
SET @media_id_6 = LAST_INSERT_ID();

INSERT INTO post_map_cards (
  post_id, subcategory_key, title, description, media_ids,
  public_email, phone_prefix, public_phone,
  venue_name, address_line, city, latitude, longitude, country_code,
  website_url, created_at, updated_at
) VALUES (
  @post_id_6, 'venues', 'Buckingham Palace',
  'Buckingham Palace has served as the official London residence of British sovereigns since 1837 and stands as one of the world''s most recognizable buildings. Originally known as Buckingham House, it was built in 1703 for the Duke of Buckingham and subsequently acquired by King George III in 1761 as a private residence for Queen Charlotte. The palace was significantly enlarged and remodeled in the 19th century, with the famous East Front (the public face of the palace) added in 1847.

The palace contains 775 rooms, including 19 State Rooms, 52 royal and guest bedrooms, 188 staff bedrooms, 92 offices, and 78 bathrooms. The State Rooms are lavishly furnished with some of the greatest treasures from the Royal Collection, including paintings by Rembrandt, Rubens, and Vermeer. The Changing of the Guard ceremony, held in the palace forecourt, is one of London''s most popular tourist attractions, showcasing British pageantry with precision military movements and traditional music.

The State Rooms are open to visitors during the summer months when the King is not in residence, typically from late July to early October. Tickets must be booked in advance and include access to the magnificent State Rooms and the 39-acre garden, home to over 350 species of wildflowers and the famous lake. The Royal Mews and the Queen''s Gallery, both located nearby, offer additional insights into royal life and the extraordinary Royal Collection.

Photo: Ell Brown (CC BY-SA 2.0)',
  CONCAT(@media_id_6),
  NULL, '+44', '303 123 7300',
  'Buckingham Palace', 'London SW1A 1AA, UK', 'London',
  51.5008413, -0.1429878, 'GB',
  'https://www.rct.uk/visit/buckingham-palace',
  NOW(), NOW()
);

-- -----------------------------------------------------
-- 7. St Paul's Cathedral
-- -----------------------------------------------------
INSERT INTO posts (post_key, member_id, member_name, subcategory_key, loc_qty, visibility, moderation_status, checkout_key, payment_status, expires_at, created_at, updated_at)
VALUES ('st-pauls-cathedral', 8, 'BerlinBeats', 'venues', 1, 'active', 'clean', 'premium-listing', 'paid', NULL, NOW(), NOW());
SET @post_id_7 = LAST_INSERT_ID();

INSERT INTO post_media (member_id, post_id, file_name, file_url, file_size, created_at, updated_at)
VALUES (8, @post_id_7, CONCAT(@post_id_7, '-spc07g7.jpg'), CONCAT('https://cdn.funmap.com/post-images/2026-01/', @post_id_7, '-spc07g7.jpg'), 10630000, NOW(), NOW());
SET @media_id_7 = LAST_INSERT_ID();

INSERT INTO post_map_cards (
  post_id, subcategory_key, title, description, media_ids,
  public_email, phone_prefix, public_phone,
  venue_name, address_line, city, latitude, longitude, country_code,
  website_url, created_at, updated_at
) VALUES (
  @post_id_7, 'venues', 'St Paul''s Cathedral',
  'St Paul''s Cathedral is an Anglican cathedral and one of London''s most famous and recognizable landmarks, sitting at the highest point of the City of London. The present cathedral, dating from the late 17th century, was designed by Sir Christopher Wren as part of a major rebuilding program following the Great Fire of London in 1666. Its magnificent dome, inspired by St Peter''s Basilica in Rome, rises 365 feet to the cross at its summit and has dominated the London skyline for over 300 years.

The cathedral has been the site of many significant events in British history, including the funerals of Lord Nelson, the Duke of Wellington, and Sir Winston Churchill, as well as the wedding of Prince Charles and Lady Diana Spencer in 1981. The interior features stunning mosaics, intricate carvings by Grinling Gibbons, and the famous Whispering Gallery, where whispers against its walls can be heard clearly on the opposite side, 112 feet away.

Visitors can climb 528 steps to reach the Golden Gallery at the top of the dome for breathtaking panoramic views of London. The cathedral offers guided tours, multimedia guides, and regular services and concerts. The crypt houses memorials and tombs of notable figures including Wren himself, whose epitaph reads: "Reader, if you seek his monument, look around you."

Photo: Wikimedia Commons (CC BY-SA 4.0)',
  CONCAT(@media_id_7),
  'reception@stpaulscathedral.org.uk', '+44', '20 7246 8350',
  'St Paul''s Cathedral', 'St Paul''s Churchyard, London EC4M 8AD, UK', 'London',
  51.51378715, -0.09845055, 'GB',
  'https://www.stpauls.co.uk',
  NOW(), NOW()
);

-- -----------------------------------------------------
-- 8. Victoria and Albert Museum
-- -----------------------------------------------------
INSERT INTO posts (post_key, member_id, member_name, subcategory_key, loc_qty, visibility, moderation_status, checkout_key, payment_status, expires_at, created_at, updated_at)
VALUES ('victoria-albert-museum', 9, 'TokyoTrends', 'venues', 1, 'active', 'clean', 'premium-listing', 'paid', NULL, NOW(), NOW());
SET @post_id_8 = LAST_INSERT_ID();

INSERT INTO post_media (member_id, post_id, file_name, file_url, file_size, created_at, updated_at)
VALUES (9, @post_id_8, CONCAT(@post_id_8, '-vam08h8.jpg'), CONCAT('https://cdn.funmap.com/post-images/2026-01/', @post_id_8, '-vam08h8.jpg'), 8850000, NOW(), NOW());
SET @media_id_8 = LAST_INSERT_ID();

INSERT INTO post_map_cards (
  post_id, subcategory_key, title, description, media_ids,
  public_email, phone_prefix, public_phone,
  venue_name, address_line, city, latitude, longitude, country_code,
  website_url, created_at, updated_at
) VALUES (
  @post_id_8, 'venues', 'Victoria and Albert Museum',
  'The Victoria and Albert Museum, known as the V&A, is the world''s largest museum of decorative arts, design, and sculpture, housing a permanent collection of over 2.27 million objects spanning 5,000 years of human creativity. Founded in 1852 following the Great Exhibition of 1851, the museum was renamed in honour of Queen Victoria and Prince Albert in 1899. The stunning building itself, with its ornate terracotta facade and grand entrance, is a work of art representing Victorian ambition and craftsmanship.

The museum''s collection is extraordinarily diverse, encompassing ceramics, glass, textiles, costumes, silver, ironwork, jewellery, furniture, medieval objects, sculpture, prints, drawings, photographs, and more. Highlights include the Raphael Cartoons, the largest collection of post-classical Italian sculpture outside Italy, extensive Asian art collections, and world-renowned fashion and textile galleries. The recently opened Photography Centre and the transformed Cast Courts displaying full-size plaster replicas of major monuments showcase the museum''s commitment to innovation.

Admission to the permanent collection is free, with ticketed temporary exhibitions. The museum includes a beautiful central courtyard garden, multiple cafes and restaurants including the stunning original Victorian refreshment rooms, and an excellent design shop. The V&A also hosts late-night Friday events combining gallery access with live music, talks, and special activities.

Photo: Diliff (CC BY-SA 3.0)',
  CONCAT(@media_id_8),
  'hello@vam.ac.uk', '+44', '20 7942 2000',
  'Victoria and Albert Museum', 'Cromwell Road, London SW7 2RL, UK', 'London',
  51.496667, -0.171944, 'GB',
  'https://www.vam.ac.uk',
  NOW(), NOW()
);

-- -----------------------------------------------------
-- 9. London Eye
-- -----------------------------------------------------
INSERT INTO posts (post_key, member_id, member_name, subcategory_key, loc_qty, visibility, moderation_status, checkout_key, payment_status, expires_at, created_at, updated_at)
VALUES ('london-eye', 10, 'LAVibeCheck', 'venues', 1, 'active', 'clean', 'premium-listing', 'paid', NULL, NOW(), NOW());
SET @post_id_9 = LAST_INSERT_ID();

INSERT INTO post_media (member_id, post_id, file_name, file_url, file_size, created_at, updated_at)
VALUES (10, @post_id_9, CONCAT(@post_id_9, '-ley09i9.jpg'), CONCAT('https://cdn.funmap.com/post-images/2026-01/', @post_id_9, '-ley09i9.jpg'), 7030000, NOW(), NOW());
SET @media_id_9 = LAST_INSERT_ID();

INSERT INTO post_map_cards (
  post_id, subcategory_key, title, description, media_ids,
  public_email, phone_prefix, public_phone,
  venue_name, address_line, city, latitude, longitude, country_code,
  website_url, created_at, updated_at
) VALUES (
  @post_id_9, 'venues', 'London Eye',
  'The London Eye, originally known as the Millennium Wheel, is a cantilevered observation wheel on the South Bank of the River Thames and one of London''s most iconic modern landmarks. Standing 135 metres tall, it was the world''s tallest Ferris wheel when it opened in 2000 and remained the tallest in Europe until 2006. Designed by architects David Marks and Julia Barfield, the wheel was intended to operate for just five years but has become a permanent fixture of the London skyline due to its immense popularity.

The wheel carries 32 sealed and air-conditioned passenger capsules, each weighing 10 tonnes and capable of holding up to 25 people, representing the 32 London boroughs. A complete rotation takes approximately 30 minutes, during which passengers enjoy spectacular views extending up to 40 kilometres on clear days, encompassing landmarks including the Houses of Parliament, Buckingham Palace, and St Paul''s Cathedral. The wheel rotates continuously at a slow enough speed to allow passengers to walk on and off at ground level.

Various ticket options are available, including standard, fast track, and champagne experiences. The London Eye is particularly magical at sunset and after dark when the wheel is illuminated and London''s lights sparkle below. Adjacent attractions include the SEA LIFE London Aquarium and the London Dungeon, making the South Bank area perfect for a full day of sightseeing.

Photo: Fred Romero (CC BY 2.0)',
  CONCAT(@media_id_9),
  'customer.services@londoneye.com', '+44', '20 7967 8021',
  'London Eye', 'Riverside Building, County Hall, Westminster Bridge Road, London SE1 7PB, UK', 'London',
  51.5033, -0.1197, 'GB',
  'https://www.londoneye.com',
  NOW(), NOW()
);

-- -----------------------------------------------------
-- 10. Science Museum
-- -----------------------------------------------------
INSERT INTO posts (post_key, member_id, member_name, subcategory_key, loc_qty, visibility, moderation_status, checkout_key, payment_status, expires_at, created_at, updated_at)
VALUES ('science-museum-london', 11, 'MelbourneArt', 'venues', 1, 'active', 'clean', 'premium-listing', 'paid', NULL, NOW(), NOW());
SET @post_id_10 = LAST_INSERT_ID();

INSERT INTO post_media (member_id, post_id, file_name, file_url, file_size, created_at, updated_at)
VALUES (11, @post_id_10, CONCAT(@post_id_10, '-scm10j0.jpg'), CONCAT('https://cdn.funmap.com/post-images/2026-01/', @post_id_10, '-scm10j0.jpg'), 3740000, NOW(), NOW());
SET @media_id_10 = LAST_INSERT_ID();

INSERT INTO post_map_cards (
  post_id, subcategory_key, title, description, media_ids,
  public_email, phone_prefix, public_phone,
  venue_name, address_line, city, latitude, longitude, country_code,
  website_url, created_at, updated_at
) VALUES (
  @post_id_10, 'venues', 'Science Museum',
  'The Science Museum in South Kensington is one of the world''s most celebrated science museums, welcoming over three million visitors annually with its remarkable collection of scientific, technological, engineering, and medical achievements. Founded in 1857, the museum holds over 300,000 items including iconic objects such as Stephenson''s Rocket, the first jet engine, and the Apollo 10 command module. The museum''s mission is to inspire visitors with the wonders of science and technology and their impact on our lives.

The museum spans seven floors and covers topics from space exploration to medical history, from computing to climate science. Interactive galleries encourage hands-on learning, while the Wonderlab gallery provides immersive experiments with light, sound, and forces. The IMAX cinema shows stunning 3D documentaries, and the flight simulator offers thrilling experiences. Historic galleries house beautifully preserved machinery and instruments that trace the evolution of human innovation.

Entry to the permanent collection is free, with charges for special exhibitions, IMAX films, and simulator experiences. The museum hosts popular science nights for adults, family sleepovers under the aircraft in the Flight gallery, and extensive educational programs for school groups. Located on Exhibition Road alongside the Natural History Museum and V&A, it forms part of an exceptional cultural quarter that can easily fill several days of exploration.

Photo: Wikimedia Commons (CC BY 2.0)',
  CONCAT(@media_id_10),
  'info@sciencemuseum.ac.uk', '+44', '330 058 0058',
  'Science Museum', 'Exhibition Road, South Kensington, London SW7 2DD, UK', 'London',
  51.497778, -0.174722, 'GB',
  'https://www.sciencemuseum.org.uk',
  NOW(), NOW()
);
