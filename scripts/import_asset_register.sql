-- =============================================================================
-- MMPZ Asset Register Import
-- Source: ASSET_REG.csv
-- Generated: 2026-07-09
--
-- Assigns assets to users based on Location column:
--   DIRECTOR OFFICE / Director       → Sandra (sandra@mmpzim.org.zw)
--   ADMIN OFFICE / Admin             → Admin & Finance Assistant (admin.assistant@mmpz.org)
--   All others (PROGRAMMS/SITE/etc)  → Logistics & Finance Assistant (logistics.assistant@mmpz.org)
--
-- Condition mapping:
--   Perfect → condition_status='good',   status='available'
--   Faulty  → condition_status='fair',   status='maintenance'
--   Broken  → condition_status='damaged',status='maintenance'
--   (empty) → condition_status='good',   status='available'
-- =============================================================================

DO $$
DECLARE
    v_director_id    INT;
    v_admin_id       INT;
    v_logistics_id   INT;
    v_creator_id     INT;
BEGIN
    -- Resolve user IDs
    SELECT id INTO v_director_id   FROM users WHERE email = 'sandra@mmpzim.org.zw'          LIMIT 1;
    SELECT id INTO v_admin_id      FROM users WHERE email = 'finance@mmpz.org'              LIMIT 1;
    SELECT id INTO v_logistics_id  FROM users WHERE email = 'logistics.assistant@mmpz.org'   LIMIT 1;
    SELECT id INTO v_creator_id    FROM users WHERE email = 'brianmagagula5@gmail.com'       LIMIT 1;

    IF v_director_id IS NULL   THEN RAISE EXCEPTION 'Director user not found (sandra@mmpzim.org.zw)'; END IF;
    IF v_admin_id IS NULL      THEN RAISE EXCEPTION 'Finance Officer not found (finance@mmpz.org)'; END IF;
    IF v_logistics_id IS NULL  THEN RAISE EXCEPTION 'Logistics user not found (logistics.assistant@mmpz.org)'; END IF;

    -- -------------------------------------------------------------------------
    -- Helper inline function: resolve assigned_user_id by location string
    -- DIRECTOR OFFICE / Director → v_director_id
    -- ADMIN OFFICE / Admin       → v_admin_id
    -- Everything else            → v_logistics_id
    -- -------------------------------------------------------------------------

    INSERT INTO assets (
        asset_code,
        asset_type,
        name,
        serial_number,
        purchase_value,
        condition_status,
        status,
        current_location,
        assigned_user_id,
        created_by_user_id,
        created_at,
        updated_at
    )
    VALUES

    -- Row 2: MMPZ0024, Pantum Printer, ADMIN OFFICE
    ('MMPZ0024', 'equipment', 'Pantum Printer', '20250426', 250.00, 'good', 'available', 'ADMIN OFFICE', v_admin_id, v_creator_id, NOW(), NOW()),

    -- Row 3: MMPZ0025, Parrot projector screen with tripod stand, ADMIN OFFICE
    ('MMPZ0025', 'equipment', 'Parrot projector screen with tripod stand', 'S430494', 250.00, 'good', 'available', 'ADMIN OFFICE', v_admin_id, v_creator_id, NOW(), NOW()),

    -- Row 4: MMPZ0026, Paper shredder, ADMIN OFFICE - Broken
    ('MMPZ0026', 'equipment', 'Paper shredder', NULL, 0.00, 'damaged', 'maintenance', 'ADMIN OFFICE', v_admin_id, v_creator_id, NOW(), NOW()),

    -- Row 5: MMPZ0029, HP Office jet Pro 8600 All in one printer, ADMIN OFFICE
    ('MMPZ0029', 'equipment', 'HP Office jet Pro 8600 All in one printer', 'CN2C4CWGZJ', 405.00, 'good', 'available', 'ADMIN OFFICE', v_admin_id, v_creator_id, NOW(), NOW()),

    -- Row 6: MMPZ0051, Capri fridge C350, ADMIN OFFICE
    ('MMPZ0051', 'equipment', 'Capri fridge C350', '2417', 410.00, 'good', 'available', 'ADMIN OFFICE', v_admin_id, v_creator_id, NOW(), NOW()),

    -- Row 7: MMPZ0047, HP Desktop computer set, ADMIN OFFICE
    ('MMPZ0047', 'equipment', 'HP Desktop computer set', 'TRF5340BHB', 500.00, 'good', 'available', 'ADMIN OFFICE', v_admin_id, v_creator_id, NOW(), NOW()),

    -- Row 8: MMPZ0052, Canonmixfy MB2040 Printer, ADMIN OFFICE - Faulty
    ('MMPZ0052', 'equipment', 'Canonmixfy MB2040 Printer', 'ADSF23809', 215.00, 'fair', 'maintenance', 'ADMIN OFFICE', v_admin_id, v_creator_id, NOW(), NOW()),

    -- Row 9: MMPZ0046, Konica Minolta Bizhub 223MFP PRINTER, YOUTH ROOM
    ('MMPZ0046', 'equipment', 'Konica Minolta Bizhub 223MFP PRINTER', 'A149041100891', 1500.00, 'good', 'available', 'YOUTH ROOM', v_logistics_id, v_creator_id, NOW(), NOW()),

    -- Row 10: MMPZ0008, Xerox WorkCentre 3210 printer, ADMIN OFFICE - Faulty
    ('MMPZ0008', 'equipment', 'Xerox WorkCentre 3210 printer', '3244074617', 680.00, 'fair', 'maintenance', 'ADMIN OFFICE', v_admin_id, v_creator_id, NOW(), NOW()),

    -- Row 11: MMPZ0053, Sharp microwave, YOUTH ROOM
    ('MMPZ0053', 'equipment', 'Sharp microwave', 'EB00484520315C15110179', 219.00, 'good', 'available', 'YOUTH ROOM', v_logistics_id, v_creator_id, NOW(), NOW()),

    -- Row 12: MMPZ0041, Samsung TV 32 inch, ADMIN OFFICE
    ('MMPZ0041', 'equipment', 'Samsung TV 32 inch', 'OB6X3MFFCO1080M', 449.00, 'good', 'available', 'ADMIN OFFICE', v_admin_id, v_creator_id, NOW(), NOW()),

    -- Row 13: MMPZ0042, White Boarder 90mm*120mm, YOUTH ROOM - Broken
    ('MMPZ0042', 'equipment', 'White Boarder 90mm x 120mm', NULL, 0.00, 'damaged', 'maintenance', 'YOUTH ROOM', v_logistics_id, v_creator_id, NOW(), NOW()),

    -- Row 14: MMPZ0043, Samsung DVD player, ADMIN OFFICE
    ('MMPZ0043', 'equipment', 'Samsung DVD player', 'ZVFZ1R1FAO1493L', 205.00, 'good', 'available', 'ADMIN OFFICE', v_admin_id, v_creator_id, NOW(), NOW()),

    -- Row 15: MMPZ0044, Comb bind binding machine, YOUTH ROOM
    ('MMPZ0044', 'equipment', 'Comb bind binding machine', 'ZI05734P', 15.00, 'good', 'available', 'YOUTH ROOM', v_logistics_id, v_creator_id, NOW(), NOW()),

    -- Row 16: MMPZ0056, Panasonic Landline Handset, DIRECTOR OFFICE
    ('MMPZ0056', 'equipment', 'Panasonic Landline Handset', '4HALM668478', 25.00, 'good', 'available', 'DIRECTOR OFFICE', v_director_id, v_creator_id, NOW(), NOW()),

    -- Row 17: MMPZ0057, TP Link Wi-Fi modem, DIRECTOR OFFICE
    ('MMPZ0057', 'equipment', 'TP Link Wi-Fi modem', '216C544003631', 25.00, 'good', 'available', 'DIRECTOR OFFICE', v_director_id, v_creator_id, NOW(), NOW()),

    -- Row 18: MMPZ0058, Panasonic Landline Handset, DIRECTOR OFFICE
    ('MMPZ0058', 'equipment', 'Panasonic Landline Handset', '5HALM668478', 25.00, 'good', 'available', 'DIRECTOR OFFICE', v_director_id, v_creator_id, NOW(), NOW()),

    -- Row 19: MMPZ0079, MAC Diesel Generator, SITE Ep
    ('MMPZ0079', 'equipment', 'MAC Diesel Generator', NULL, 2700.00, 'good', 'available', 'SITE Ep', v_logistics_id, v_creator_id, NOW(), NOW()),

    -- Row 20: MMPZ0078, Banner, ADMIN OFFICE
    ('MMPZ0078', 'equipment', 'Banner', NULL, 50.00, 'good', 'available', 'ADMIN OFFICE', v_admin_id, v_creator_id, NOW(), NOW()),

    -- Row 21: MMPZ0080, Roll-up banner, ADMIN OFFICE
    ('MMPZ0080', 'equipment', 'Roll-up banner', NULL, 70.00, 'good', 'available', 'ADMIN OFFICE', v_admin_id, v_creator_id, NOW(), NOW()),

    -- Row 22: MMPZ (no number), Epson printer, ADMIN OFFICE
    ('MMPZ-EP-001', 'equipment', 'Epson printer', NULL, 200.00, 'good', 'available', 'ADMIN OFFICE', v_admin_id, v_creator_id, NOW(), NOW()),

    -- Row 23: MMPZ, Acer Big White, YOUTH ROOM
    ('MMPZ-AB-001', 'equipment', 'Acer Big White', 'DQBEBEA0010190082F3000', 760.00, 'good', 'available', 'YOUTH ROOM', v_logistics_id, v_creator_id, NOW(), NOW()),

    -- Row 24: MMPZ, Acer Big White, ADMIN OFFICE
    ('MMPZ-AB-002', 'equipment', 'Acer Big White', 'DQBEBEA001019008483000', 760.00, 'good', 'available', 'ADMIN OFFICE', v_admin_id, v_creator_id, NOW(), NOW()),

    -- Row 25: MMPZ, Capri deep fridge, YOUTH ROOM
    ('MMPZ-CF-001', 'equipment', 'Capri deep fridge', 'B122104785', 400.00, 'good', 'available', 'YOUTH ROOM', v_logistics_id, v_creator_id, NOW(), NOW()),

    -- Row 26: MMPZ0059, HP Elite book laptop, ADMIN OFFICE - Broken
    ('MMPZ0059', 'equipment', 'HP Elite book laptop', '5CG65038CR', 0.00, 'damaged', 'maintenance', 'ADMIN OFFICE', v_admin_id, v_creator_id, NOW(), NOW()),

    -- Row 27: MMPZ0061, HP 255 G5 laptop, ADMIN OFFICE - Broken
    ('MMPZ0061', 'equipment', 'HP 255 G5 laptop', 'CND72338J9', 0.00, 'damaged', 'maintenance', 'ADMIN OFFICE', v_admin_id, v_creator_id, NOW(), NOW()),

    -- Row 28: MMPZ, PHILIPS TV, YOUTH ROOM
    ('MMPZ-PT-001', 'equipment', 'PHILIPS TV', NULL, 0.00, 'good', 'available', 'YOUTH ROOM', v_logistics_id, v_creator_id, NOW(), NOW()),

    -- Row 29: MMPZ, Microphone, ADMIN OFFICE
    ('MMPZ-MIC-001', 'equipment', 'Microphone', NULL, 60.00, 'good', 'available', 'ADMIN OFFICE', v_admin_id, v_creator_id, NOW(), NOW()),

    -- Row 30: MMPZ, Modem, ADMIN OFFICE
    ('MMPZ-MDM-001', 'equipment', 'Modem', '222AOW3008813', 220.00, 'good', 'available', 'ADMIN OFFICE', v_admin_id, v_creator_id, NOW(), NOW()),

    -- Row 31: MMPZ, Lenovo mini laptop, PROGRAMMS
    ('MMPZ-LML-001', 'equipment', 'Lenovo mini laptop', 'SM-Y00ZNQYW', 150.00, 'good', 'available', 'PROGRAMMS', v_logistics_id, v_creator_id, NOW(), NOW()),

    -- Row 32: MMPZ, Lenovo mini laptop, ADMIN OFFICE
    ('MMPZ-LML-002', 'equipment', 'Lenovo mini laptop', 'SM-YD-02MMNX', 150.00, 'good', 'available', 'ADMIN OFFICE', v_admin_id, v_creator_id, NOW(), NOW()),

    -- Row 33: MMPZ, HP Laptop, PROGRAMMS SIQO
    ('MMPZ-HPL-001', 'equipment', 'HP Laptop', 'CND328155B', 800.00, 'good', 'available', 'PROGRAMMS SIQO', v_logistics_id, v_creator_id, NOW(), NOW()),

    -- Row 34: MMPZ, HP laptop, ADMIN OFFICE WARINDA
    ('MMPZ-HPL-002', 'equipment', 'HP laptop', 'CND3281RXF', 800.00, 'good', 'available', 'ADMIN OFFICE WARINDA', v_admin_id, v_creator_id, NOW(), NOW()),

    -- Row 35: MMPZ, HP Laptop, PROGRAMMS KUMIRA
    ('MMPZ-HPL-003', 'equipment', 'HP Laptop', 'CND2064VKG', 800.00, 'good', 'available', 'PROGRAMMS KUMIRA', v_logistics_id, v_creator_id, NOW(), NOW()),

    -- Row 36: MMPZ, Levovo, MLAUZI
    ('MMPZ-LNV-001', 'equipment', 'Levovo', 'NXHNSEA00295012CE67600', 0.00, 'good', 'available', 'MLAUZI', v_logistics_id, v_creator_id, NOW(), NOW()),

    -- Row 37: MMPZ, Lenovo laptop, DIRECTOR CHIOMVU
    ('MMPZ-LLC-001', 'equipment', 'Lenovo laptop', 'PW007996', 1500.00, 'good', 'available', 'DIRECTOR CHIOMVU', v_director_id, v_creator_id, NOW(), NOW()),

    -- Row 38: MMPZ, LENOVO, PROGRAMMS FREDDY
    ('MMPZ-LNV-002', 'equipment', 'LENOVO', NULL, 670.00, 'good', 'available', 'PROGRAMMS FREDDY', v_logistics_id, v_creator_id, NOW(), NOW()),

    -- Row 39: MMPZ, Party Speaker, ADMIN OFFICE
    ('MMPZ-PSP-001', 'equipment', 'Party Speaker', 'DXC108', 200.00, 'good', 'available', 'ADMIN OFFICE', v_admin_id, v_creator_id, NOW(), NOW()),

    -- Row 40: MMPZ, Y6 Prime Phone, PROGRAMMING RUMBI
    ('MMPZ-Y6P-001', 'equipment', 'Y6 Prime Phone', NULL, 180.00, 'good', 'available', 'PROGRAMMING RUMBI', v_logistics_id, v_creator_id, NOW(), NOW()),

    -- Row 41: MMPZ, Y6 Prime Phone, PROGRAMMING BRENDO
    ('MMPZ-Y6P-002', 'equipment', 'Y6 Prime Phone', NULL, 180.00, 'good', 'available', 'PROGRAMMING BRENDO', v_logistics_id, v_creator_id, NOW(), NOW()),

    -- Row 42: MMPZ, Selfi-board, Programming
    ('MMPZ-SFB-001', 'equipment', 'Selfi-board', NULL, 50.00, 'good', 'available', 'Programming', v_logistics_id, v_creator_id, NOW(), NOW()),

    -- Row 43: MMPZ, A0 Carrying Bag, Admin
    ('MMPZ-ACB-001', 'equipment', 'A0 Carrying Bag', NULL, 25.00, 'good', 'available', 'Admin', v_admin_id, v_creator_id, NOW(), NOW()),

    -- Row 44: MMPZ, Executive Desk brown, Director Office
    ('MMPZ-EDB-001', 'equipment', 'Executive Desk brown', NULL, 390.00, 'good', 'available', 'Director Office', v_director_id, v_creator_id, NOW(), NOW()),

    -- Row 45: MMPZ, Regular Office desk brown, Director Office
    ('MMPZ-ROD-001', 'equipment', 'Regular Office desk brown', NULL, 195.00, 'good', 'available', 'Director Office', v_director_id, v_creator_id, NOW(), NOW()),

    -- Row 46: MMPZ, Z HP Laptop, Director
    ('MMPZ-ZHL-001', 'equipment', 'Z HP Laptop', '5CG12810YQ', 480.00, 'good', 'available', 'Director', v_director_id, v_creator_id, NOW(), NOW()),

    -- Row 47: MMPZ, Flip chart stand 1 legged, Admin
    ('MMPZ-FCS-001', 'equipment', 'Flip chart stand 1 legged', NULL, 120.00, 'good', 'available', 'Admin', v_admin_id, v_creator_id, NOW(), NOW()),

    -- Row 48: MMPZ, Ringlight, Admin Office
    ('MMPZ-RGL-001', 'equipment', 'Ringlight', NULL, 60.00, 'good', 'available', 'Admin Office', v_admin_id, v_creator_id, NOW(), NOW()),

    -- Row 49: MMPZ, Wireless mic, Admin Office
    ('MMPZ-WMC-001', 'equipment', 'Wireless mic', NULL, 40.00, 'good', 'available', 'Admin Office', v_admin_id, v_creator_id, NOW(), NOW()),

    -- Row 50: MMPZ, Three sitter couch orange, Youth Room
    ('MMPZ-TSC-001', 'equipment', 'Three sitter couch orange', NULL, 240.00, 'good', 'available', 'Youth Room', v_logistics_id, v_creator_id, NOW(), NOW()),

    -- Row 51: MMPZ, Dust bin, Director Office
    ('MMPZ-DSB-001', 'equipment', 'Dust bin', NULL, 7.00, 'good', 'available', 'Director Office', v_director_id, v_creator_id, NOW(), NOW()),

    -- Row 52: MMPZ, MMPZ Executive banner, Admin Office
    ('MMPZ-MEB-001', 'equipment', 'MMPZ Executive banner', NULL, 0.00, 'good', 'available', 'Admin Office', v_admin_id, v_creator_id, NOW(), NOW()),

    -- Row 53: MMPZ, Smart biz Indoor moderm, Admin Office
    ('MMPZ-SBM-001', 'equipment', 'Smart biz Indoor modem', NULL, 0.00, 'good', 'available', 'Admin Office', v_admin_id, v_creator_id, NOW(), NOW()),

    -- Row 54: MMPZ, Tripod stand, Admin Office
    ('MMPZ-TPS-001', 'equipment', 'Tripod stand', NULL, 40.00, 'good', 'available', 'Admin Office', v_admin_id, v_creator_id, NOW(), NOW()),

    -- Row 55: MMPZ, Condenser, Admin Office
    ('MMPZ-CND-001', 'equipment', 'Condenser', NULL, 45.00, 'good', 'available', 'Admin Office', v_admin_id, v_creator_id, NOW(), NOW()),

    -- Row 56: MMPZ, Center Table (qty 2), Youth Room
    ('MMPZ-CTB-001', 'equipment', 'Center Table', NULL, 105.00, 'good', 'available', 'Youth Room', v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-CTB-002', 'equipment', 'Center Table', NULL, 105.00, 'good', 'available', 'Youth Room', v_logistics_id, v_creator_id, NOW(), NOW()),

    -- Row 57: MMPZ, Yellow shell chair, Youth Room
    ('MMPZ-YSC-001', 'equipment', 'Yellow shell chair', NULL, 140.00, 'good', 'available', 'Youth Room', v_logistics_id, v_creator_id, NOW(), NOW()),

    -- Row 58: MMPZ, Branded Table cloth, Admin Office
    ('MMPZ-BTC-001', 'equipment', 'Branded Table cloth', NULL, 30.00, 'good', 'available', 'Admin Office', v_admin_id, v_creator_id, NOW(), NOW()),

    -- Row 59: MMPZ, Foldable table, Admin Office
    ('MMPZ-FTB-001', 'equipment', 'Foldable table', NULL, 50.00, 'good', 'available', 'Admin Office', v_admin_id, v_creator_id, NOW(), NOW()),

    -- Row 60: MMPZ, Foldable chairs (qty 3), Admin Office
    ('MMPZ-FCH-001', 'equipment', 'Foldable chair', NULL, 25.00, 'good', 'available', 'Admin Office', v_admin_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-FCH-002', 'equipment', 'Foldable chair', NULL, 25.00, 'good', 'available', 'Admin Office', v_admin_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-FCH-003', 'equipment', 'Foldable chair', NULL, 25.00, 'good', 'available', 'Admin Office', v_admin_id, v_creator_id, NOW(), NOW()),

    -- Row 61: MMPZ, MMPZ Podcast Banner, Admin Office
    ('MMPZ-MPB-001', 'equipment', 'MMPZ Podcast Banner', NULL, 120.00, 'good', 'available', 'Admin Office', v_admin_id, v_creator_id, NOW(), NOW()),

    -- Row 62: MMPZ, MMPZ Tear drop mental health Banner, Admin Office
    ('MMPZ-MTB-001', 'equipment', 'MMPZ Tear drop mental health Banner', NULL, 0.00, 'good', 'available', 'Admin Office', v_admin_id, v_creator_id, NOW(), NOW()),

    -- Row 63: MMPZ, Office Chairs swivel black leather (qty 2), Admin Office
    ('MMPZ-OSC-001', 'equipment', 'Office Chair swivel black leather', NULL, 0.00, 'good', 'available', 'Admin Office', v_admin_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-OSC-002', 'equipment', 'Office Chair swivel black leather', NULL, 0.00, 'good', 'available', 'Admin Office', v_admin_id, v_creator_id, NOW(), NOW()),

    -- Row 64: MMPZ, Netted visitors chairs (qty 2), Directors Office
    ('MMPZ-NVC-001', 'equipment', 'Netted visitors chair', NULL, 90.00, 'good', 'available', 'Directors Office', v_director_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-NVC-002', 'equipment', 'Netted visitors chair', NULL, 90.00, 'good', 'available', 'Directors Office', v_director_id, v_creator_id, NOW(), NOW()),

    -- Row 65: MMPZ, Snake and ladders game, Youth room
    ('MMPZ-SLG-001', 'equipment', 'Snake and ladders game', NULL, 100.00, 'good', 'available', 'Youth room', v_logistics_id, v_creator_id, NOW(), NOW()),

    -- Row 66: MMPZ0016, DESK, DIRECTOR OFFICE
    ('MMPZ0016', 'equipment', 'DESK', NULL, 0.00, 'good', 'available', 'DIRECTOR OFFICE', v_director_id, v_creator_id, NOW(), NOW()),

    -- Row 67: MMPZ0017, SWIVEL CHAIR, DIRECTOR OFFICE - BROKEN (status in Asset Status column)
    ('MMPZ0017', 'equipment', 'SWIVEL CHAIR', NULL, 0.00, 'damaged', 'maintenance', 'DIRECTOR OFFICE', v_director_id, v_creator_id, NOW(), NOW()),

    -- Row 68: MMPZ, STEEL CABINET, ADMIN OFFICE
    ('MMPZ-SCB-001', 'equipment', 'STEEL CABINET', NULL, 200.00, 'good', 'available', 'ADMIN OFFICE', v_admin_id, v_creator_id, NOW(), NOW()),

    -- Row 69: MMPZ, STEEL CABINET, DIRECTOR OFFICE
    ('MMPZ-SCB-002', 'equipment', 'STEEL CABINET', NULL, 200.00, 'good', 'available', 'DIRECTOR OFFICE', v_director_id, v_creator_id, NOW(), NOW()),

    -- Row 70: MMPZ0021, SWIVEL CHAIR, ADMIN OFFICE
    ('MMPZ0021', 'equipment', 'SWIVEL CHAIR', NULL, 0.00, 'good', 'available', 'ADMIN OFFICE', v_admin_id, v_creator_id, NOW(), NOW()),

    -- Row 71: MMPZ, VISITORS CHAIR BLACK, ADMIN OFFICE
    ('MMPZ-VCB-001', 'equipment', 'VISITORS CHAIR BLACK', NULL, 90.00, 'good', 'available', 'ADMIN OFFICE', v_admin_id, v_creator_id, NOW(), NOW()),

    -- Row 72: MMPZ, VISITORS CHAIR BLACK, ADMIN OFFICE - BROKEN
    ('MMPZ-VCB-002', 'equipment', 'VISITORS CHAIR BLACK', NULL, 90.00, 'damaged', 'maintenance', 'ADMIN OFFICE', v_admin_id, v_creator_id, NOW(), NOW()),

    -- Row 73: MMPZ, STUDENT DESK, YOUTH ROOM
    ('MMPZ-STD-001', 'equipment', 'STUDENT DESK', NULL, 0.00, 'good', 'available', 'YOUTH ROOM', v_logistics_id, v_creator_id, NOW(), NOW()),

    -- Row 74: MMPZ, OFFICE DESK, YOUTH ROOM
    ('MMPZ-OFD-001', 'equipment', 'OFFICE DESK', NULL, 0.00, 'good', 'available', 'YOUTH ROOM', v_logistics_id, v_creator_id, NOW(), NOW()),

    -- Row 75: MMPZ, POOL TABLE, YOUTH ROOM
    ('MMPZ-PLT-001', 'equipment', 'POOL TABLE', NULL, 220.00, 'good', 'available', 'YOUTH ROOM', v_logistics_id, v_creator_id, NOW(), NOW()),

    -- Row 76: MMPZ, VISITORS CHAIR, YOUTH ROOM - BROKEN
    ('MMPZ-VCH-001', 'equipment', 'VISITORS CHAIR', NULL, 0.00, 'damaged', 'maintenance', 'YOUTH ROOM', v_logistics_id, v_creator_id, NOW(), NOW()),

    -- Row 77: MMPZ, WOODEN SHELF, YOUTH ROOM
    ('MMPZ-WSH-001', 'equipment', 'WOODEN SHELF', NULL, 0.00, 'good', 'available', 'YOUTH ROOM', v_logistics_id, v_creator_id, NOW(), NOW()),

    -- Row 78: MMPZ, BIN BAGS (qty 5), YOUTH ROOM
    ('MMPZ-BNB-001', 'equipment', 'BIN BAGS', NULL, 25.00, 'good', 'available', 'YOUTH ROOM', v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-BNB-002', 'equipment', 'BIN BAGS', NULL, 25.00, 'good', 'available', 'YOUTH ROOM', v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-BNB-003', 'equipment', 'BIN BAGS', NULL, 25.00, 'good', 'available', 'YOUTH ROOM', v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-BNB-004', 'equipment', 'BIN BAGS', NULL, 25.00, 'good', 'available', 'YOUTH ROOM', v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-BNB-005', 'equipment', 'BIN BAGS', NULL, 25.00, 'good', 'available', 'YOUTH ROOM', v_logistics_id, v_creator_id, NOW(), NOW()),

    -- Row 79: MMPZ, VISITORS BLACK CHAIR, PROGRAMMS
    ('MMPZ-VBC-001', 'equipment', 'VISITORS BLACK CHAIR', NULL, 80.00, 'good', 'available', 'PROGRAMMS', v_logistics_id, v_creator_id, NOW(), NOW()),

    -- Row 80: MMPZ, OFFICE DESKS (qty 2), PROGRAMMS
    ('MMPZ-ODS-001', 'equipment', 'OFFICE DESK', NULL, 200.00, 'good', 'available', 'PROGRAMMS', v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-ODS-002', 'equipment', 'OFFICE DESK', NULL, 200.00, 'good', 'available', 'PROGRAMMS', v_logistics_id, v_creator_id, NOW(), NOW()),

    -- Row 81: MMPZ, WOODEN SHELF, PROGRAMMS
    ('MMPZ-WSH-002', 'equipment', 'WOODEN SHELF', NULL, 120.00, 'good', 'available', 'PROGRAMMS', v_logistics_id, v_creator_id, NOW(), NOW()),

    -- Row 82: MMPZ, WOODEN CABINET (qty 2), PROGRAMMS
    ('MMPZ-WCA-001', 'equipment', 'WOODEN CABINET', NULL, 75.00, 'good', 'available', 'PROGRAMMS', v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-WCA-002', 'equipment', 'WOODEN CABINET', NULL, 75.00, 'good', 'available', 'PROGRAMMS', v_logistics_id, v_creator_id, NOW(), NOW()),

    -- Row 83: MMPZ, FLIP CHART STAND, ADMIN OFFICE
    ('MMPZ-FLC-001', 'equipment', 'FLIP CHART STAND', NULL, 100.00, 'good', 'available', 'ADMIN OFFICE', v_admin_id, v_creator_id, NOW(), NOW()),

    -- Row 84: MMPZ, OFFICE DESK (qty 3), ADMIN OFFICE
    ('MMPZ-ADK-001', 'equipment', 'OFFICE DESK', NULL, 250.00, 'good', 'available', 'ADMIN OFFICE', v_admin_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-ADK-002', 'equipment', 'OFFICE DESK', NULL, 250.00, 'good', 'available', 'ADMIN OFFICE', v_admin_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-ADK-003', 'equipment', 'OFFICE DESK', NULL, 250.00, 'good', 'available', 'ADMIN OFFICE', v_admin_id, v_creator_id, NOW(), NOW()),

    -- Row 85: MMPZ, Branded Rubber stamp, ADMIN OFFICE
    ('MMPZ-BRS-001', 'equipment', 'Branded Rubber stamp', NULL, 45.00, 'good', 'available', 'ADMIN OFFICE', v_admin_id, v_creator_id, NOW(), NOW()),

    -- Row 86: MMPZ, Megaphone, ADMIN OFFICE
    ('MMPZ-MGP-001', 'equipment', 'Megaphone', NULL, 60.00, 'good', 'available', 'ADMIN OFFICE', v_admin_id, v_creator_id, NOW(), NOW()),

    -- Row 87: MMPZ, 6 KG Dumbells (qty 2), SITE
    ('MMPZ-6KD-001', 'equipment', '6 KG Dumbells', NULL, 30.00, 'good', 'available', 'SITE', v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-6KD-002', 'equipment', '6 KG Dumbells', NULL, 30.00, 'good', 'available', 'SITE', v_logistics_id, v_creator_id, NOW(), NOW()),

    -- Row 88: MMPZ, 5 kg Dumbells (qty 2), SITE
    ('MMPZ-5KD-001', 'equipment', '5 kg Dumbells', NULL, 25.00, 'good', 'available', 'SITE', v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-5KD-002', 'equipment', '5 kg Dumbells', NULL, 25.00, 'good', 'available', 'SITE', v_logistics_id, v_creator_id, NOW(), NOW()),

    -- Row 89: MMPZ, 4 kg Dumbells (qty 2), SITE
    ('MMPZ-4KD-001', 'equipment', '4 kg Dumbells', NULL, 15.00, 'good', 'available', 'SITE', v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-4KD-002', 'equipment', '4 kg Dumbells', NULL, 15.00, 'good', 'available', 'SITE', v_logistics_id, v_creator_id, NOW(), NOW()),

    -- Row 90: MMPZ, Gym mats (qty 3), SITE
    ('MMPZ-GYM-001', 'equipment', 'Gym mat', NULL, 10.00, 'good', 'available', 'SITE', v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-GYM-002', 'equipment', 'Gym mat', NULL, 10.00, 'good', 'available', 'SITE', v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-GYM-003', 'equipment', 'Gym mat', NULL, 10.00, 'good', 'available', 'SITE', v_logistics_id, v_creator_id, NOW(), NOW()),

    -- Row 91: MMPZ, Skipping ropes (qty 3), SITE
    ('MMPZ-SKP-001', 'equipment', 'Skipping rope', NULL, 5.00, 'good', 'available', 'SITE', v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-SKP-002', 'equipment', 'Skipping rope', NULL, 5.00, 'good', 'available', 'SITE', v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-SKP-003', 'equipment', 'Skipping rope', NULL, 5.00, 'good', 'available', 'SITE', v_logistics_id, v_creator_id, NOW(), NOW()),

    -- Row 92: MMPZ, Portable examination couch, SITE
    ('MMPZ-PEC-001', 'equipment', 'Portable examination couch', NULL, 290.00, 'good', 'available', 'SITE', v_logistics_id, v_creator_id, NOW(), NOW()),

    -- Row 93: MMPZ, Emergency Drug Trolley, SITE
    ('MMPZ-EDT-001', 'equipment', 'Emergency Drug Trolley', NULL, 320.00, 'good', 'available', 'SITE', v_logistics_id, v_creator_id, NOW(), NOW()),

    -- Row 94: MMPZ, Cabinet -4 drawer, SITE
    ('MMPZ-C4D-001', 'equipment', 'Cabinet - 4 drawer', NULL, 250.00, 'good', 'available', 'SITE', v_logistics_id, v_creator_id, NOW(), NOW()),

    -- Row 95: MMPZ, WATER TANKS, SITE
    ('MMPZ-WTK-001', 'equipment', 'WATER TANKS', NULL, 455.00, 'good', 'available', 'SITE', v_logistics_id, v_creator_id, NOW(), NOW()),

    -- Row 96: MMPZ, EPSON PRINTER, ADMIN
    ('MMPZ-EPS-001', 'equipment', 'EPSON PRINTER', NULL, 400.00, 'good', 'available', 'ADMIN', v_admin_id, v_creator_id, NOW(), NOW()),

    -- Row 97: MMPZ, BLACK WOODEN CABINET, YOUTH ROOM
    ('MMPZ-BWC-001', 'equipment', 'BLACK WOODEN CABINET', NULL, 200.00, 'good', 'available', 'YOUTH ROOM', v_logistics_id, v_creator_id, NOW(), NOW()),

    -- Row 98: MMPZ, BUFFALO BICYCLES (qty 12), CCF & SITE
    ('MMPZ-BFC-001', 'equipment', 'BUFFALO BICYCLE', NULL, 1800.00, 'good', 'available', 'CCF & SITE', v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-BFC-002', 'equipment', 'BUFFALO BICYCLE', NULL, 1800.00, 'good', 'available', 'CCF & SITE', v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-BFC-003', 'equipment', 'BUFFALO BICYCLE', NULL, 1800.00, 'good', 'available', 'CCF & SITE', v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-BFC-004', 'equipment', 'BUFFALO BICYCLE', NULL, 1800.00, 'good', 'available', 'CCF & SITE', v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-BFC-005', 'equipment', 'BUFFALO BICYCLE', NULL, 1800.00, 'good', 'available', 'CCF & SITE', v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-BFC-006', 'equipment', 'BUFFALO BICYCLE', NULL, 1800.00, 'good', 'available', 'CCF & SITE', v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-BFC-007', 'equipment', 'BUFFALO BICYCLE', NULL, 1800.00, 'good', 'available', 'CCF & SITE', v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-BFC-008', 'equipment', 'BUFFALO BICYCLE', NULL, 1800.00, 'good', 'available', 'CCF & SITE', v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-BFC-009', 'equipment', 'BUFFALO BICYCLE', NULL, 1800.00, 'good', 'available', 'CCF & SITE', v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-BFC-010', 'equipment', 'BUFFALO BICYCLE', NULL, 1800.00, 'good', 'available', 'CCF & SITE', v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-BFC-011', 'equipment', 'BUFFALO BICYCLE', NULL, 1800.00, 'good', 'available', 'CCF & SITE', v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-BFC-012', 'equipment', 'BUFFALO BICYCLE', NULL, 1800.00, 'good', 'available', 'CCF & SITE', v_logistics_id, v_creator_id, NOW(), NOW()),

    -- Row 99: MMPZ, NISSAN CARAVAN NV 350, DIRECTOR OFFICE (Motor Vehicle)
    ('MMPZ-NCV-001', 'vehicle', 'NISSAN CARAVAN NV 350', 'AFV2384', 12850.00, 'good', 'available', 'DIRECTOR OFFICE', v_director_id, v_creator_id, NOW(), NOW())

    ON CONFLICT (asset_code) DO NOTHING;

    RAISE NOTICE 'Asset register import complete. % rows processed.', (SELECT COUNT(*) FROM assets);
END $$;
