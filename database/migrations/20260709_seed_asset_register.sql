-- =============================================================================
-- Migration: 20260709_seed_asset_register.sql
-- Purpose:   Import the MMPZ asset register into the assets table.
--
-- SAFE TO RE-RUN: All inserts use ON CONFLICT (asset_code) DO NOTHING,
-- so existing records are never overwritten or deleted.
--
-- User assignment by location:
--   DIRECTOR OFFICE / Director  → Sandra   (sandra@mmpzim.org.zw)
--   ADMIN OFFICE / Admin        → Finance Officer (finance@mmpz.org)
--   Everything else             → Logistics & Finance Assistant (logistics.assistant@mmpz.org)
--
-- Condition mapping from CSV "Asset Status":
--   Perfect / (blank) → condition_status='good',    status='available'
--   Faulty            → condition_status='fair',    status='maintenance'
--   Broken / BROKEN   → condition_status='damaged', status='maintenance'
-- =============================================================================

DO $$
DECLARE
    v_director_id   INT;
    v_finance_id    INT;
    v_logistics_id  INT;
    v_creator_id    INT;
BEGIN
    -- Resolve user IDs — fail loudly if any account is missing
    SELECT id INTO v_director_id  FROM users WHERE email = 'sandra@mmpzim.org.zw'         LIMIT 1;
    SELECT id INTO v_finance_id   FROM users WHERE email = 'finance@mmpz.org'             LIMIT 1;
    SELECT id INTO v_logistics_id FROM users WHERE email = 'logistics.assistant@mmpz.org' LIMIT 1;
    SELECT id INTO v_creator_id   FROM users WHERE email = 'brianmagagula5@gmail.com'     LIMIT 1;

    IF v_director_id  IS NULL THEN RAISE EXCEPTION 'Director user not found: sandra@mmpzim.org.zw'; END IF;
    IF v_finance_id   IS NULL THEN RAISE EXCEPTION 'Finance Officer not found: finance@mmpz.org'; END IF;
    IF v_logistics_id IS NULL THEN RAISE EXCEPTION 'Logistics user not found: logistics.assistant@mmpz.org'; END IF;

    -- -------------------------------------------------------------------------
    -- Asset Register — 99 source rows expanded to individual asset records
    -- Multi-quantity rows (e.g. qty 3 chairs) become separate numbered entries
    -- ON CONFLICT DO NOTHING ensures this migration is safe to deploy repeatedly
    -- -------------------------------------------------------------------------

    INSERT INTO assets (
        asset_code, asset_type, name, serial_number,
        purchase_value, condition_status, status,
        current_location, assigned_user_id, created_by_user_id,
        created_at, updated_at
    ) VALUES

    -- ── ADMIN OFFICE ────────────────────────────────────────────────────────
    ('MMPZ0024',    'equipment', 'Pantum Printer',                        '20250426',               250.00, 'good',    'available',   'ADMIN OFFICE',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ0025',    'equipment', 'Parrot projector screen with tripod stand', 'S430494',            250.00, 'good',    'available',   'ADMIN OFFICE',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ0026',    'equipment', 'Paper shredder',                        NULL,                       0.00, 'damaged', 'maintenance', 'ADMIN OFFICE',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ0029',    'equipment', 'HP Office jet Pro 8600 All in one printer', 'CN2C4CWGZJ',         405.00, 'good',    'available',   'ADMIN OFFICE',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ0051',    'equipment', 'Capri fridge C350',                     '2417',                   410.00, 'good',    'available',   'ADMIN OFFICE',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ0047',    'equipment', 'HP Desktop computer set',               'TRF5340BHB',             500.00, 'good',    'available',   'ADMIN OFFICE',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ0052',    'equipment', 'Canonmixfy MB2040 Printer',             'ADSF23809',              215.00, 'fair',    'maintenance', 'ADMIN OFFICE',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ0008',    'equipment', 'Xerox WorkCentre 3210 printer',         '3244074617',             680.00, 'fair',    'maintenance', 'ADMIN OFFICE',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ0041',    'equipment', 'Samsung TV 32 inch',                    'OB6X3MFFCO1080M',        449.00, 'good',    'available',   'ADMIN OFFICE',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ0043',    'equipment', 'Samsung DVD player',                    'ZVFZ1R1FAO1493L',        205.00, 'good',    'available',   'ADMIN OFFICE',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ0059',    'equipment', 'HP Elite book laptop',                  '5CG65038CR',               0.00, 'damaged', 'maintenance', 'ADMIN OFFICE',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ0061',    'equipment', 'HP 255 G5 laptop',                      'CND72338J9',               0.00, 'damaged', 'maintenance', 'ADMIN OFFICE',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ0078',    'equipment', 'Banner',                                NULL,                      50.00, 'good',    'available',   'ADMIN OFFICE',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ0080',    'equipment', 'Roll-up banner',                        NULL,                      70.00, 'good',    'available',   'ADMIN OFFICE',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ0021',    'equipment', 'SWIVEL CHAIR',                          NULL,                       0.00, 'good',    'available',   'ADMIN OFFICE',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ-EP-001', 'equipment', 'Epson printer',                         NULL,                     200.00, 'good',    'available',   'ADMIN OFFICE',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ-AB-002', 'equipment', 'Acer Big White',                        'DQBEBEA001019008483000', 760.00, 'good',    'available',   'ADMIN OFFICE',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ-LML-002','equipment', 'Lenovo mini laptop',                    'SM-YD-02MMNX',           150.00, 'good',    'available',   'ADMIN OFFICE',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ-HPL-002','equipment', 'HP laptop',                             'CND3281RXF',             800.00, 'good',    'available',   'ADMIN OFFICE WARINDA', v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ-MIC-001','equipment', 'Microphone',                            NULL,                      60.00, 'good',    'available',   'ADMIN OFFICE',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ-MDM-001','equipment', 'Modem',                                 '222AOW3008813',          220.00, 'good',    'available',   'ADMIN OFFICE',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ-PSP-001','equipment', 'Party Speaker',                         'DXC108',                 200.00, 'good',    'available',   'ADMIN OFFICE',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ-ACB-001','equipment', 'A0 Carrying Bag',                       NULL,                      25.00, 'good',    'available',   'Admin',                v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ-FCS-001','equipment', 'Flip chart stand 1 legged',             NULL,                     120.00, 'good',    'available',   'Admin',                v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ-RGL-001','equipment', 'Ringlight',                             NULL,                      60.00, 'good',    'available',   'Admin Office',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ-WMC-001','equipment', 'Wireless mic',                          NULL,                      40.00, 'good',    'available',   'Admin Office',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ-BTC-001','equipment', 'Branded Table cloth',                   NULL,                      30.00, 'good',    'available',   'Admin Office',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ-FTB-001','equipment', 'Foldable table',                        NULL,                      50.00, 'good',    'available',   'Admin Office',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ-FCH-001','equipment', 'Foldable chair',                        NULL,                      25.00, 'good',    'available',   'Admin Office',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ-FCH-002','equipment', 'Foldable chair',                        NULL,                      25.00, 'good',    'available',   'Admin Office',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ-FCH-003','equipment', 'Foldable chair',                        NULL,                      25.00, 'good',    'available',   'Admin Office',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ-MPB-001','equipment', 'MMPZ Podcast Banner',                   NULL,                     120.00, 'good',    'available',   'Admin Office',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ-MTB-001','equipment', 'MMPZ Tear drop mental health Banner',   NULL,                       0.00, 'good',    'available',   'Admin Office',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ-OSC-001','equipment', 'Office Chair swivel black leather',     NULL,                       0.00, 'good',    'available',   'Admin Office',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ-OSC-002','equipment', 'Office Chair swivel black leather',     NULL,                       0.00, 'good',    'available',   'Admin Office',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ-VCB-001','equipment', 'VISITORS CHAIR BLACK',                  NULL,                      90.00, 'good',    'available',   'ADMIN OFFICE',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ-VCB-002','equipment', 'VISITORS CHAIR BLACK',                  NULL,                      90.00, 'damaged', 'maintenance', 'ADMIN OFFICE',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ-SCB-001','equipment', 'STEEL CABINET',                         NULL,                     200.00, 'good',    'available',   'ADMIN OFFICE',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ-SBM-001','equipment', 'Smart biz Indoor modem',                NULL,                       0.00, 'good',    'available',   'Admin Office',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ-TPS-001','equipment', 'Tripod stand',                          NULL,                      40.00, 'good',    'available',   'Admin Office',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ-CND-001','equipment', 'Condenser',                             NULL,                      45.00, 'good',    'available',   'Admin Office',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ-MEB-001','equipment', 'MMPZ Executive banner',                 NULL,                       0.00, 'good',    'available',   'Admin Office',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ-FLC-001','equipment', 'FLIP CHART STAND',                      NULL,                     100.00, 'good',    'available',   'ADMIN OFFICE',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ-ADK-001','equipment', 'OFFICE DESK',                           NULL,                     250.00, 'good',    'available',   'ADMIN OFFICE',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ-ADK-002','equipment', 'OFFICE DESK',                           NULL,                     250.00, 'good',    'available',   'ADMIN OFFICE',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ-ADK-003','equipment', 'OFFICE DESK',                           NULL,                     250.00, 'good',    'available',   'ADMIN OFFICE',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ-BRS-001','equipment', 'Branded Rubber stamp',                  NULL,                      45.00, 'good',    'available',   'ADMIN OFFICE',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ-MGP-001','equipment', 'Megaphone',                             NULL,                      60.00, 'good',    'available',   'ADMIN OFFICE',         v_finance_id,   v_creator_id, NOW(), NOW()),
    ('MMPZ-EPS-001','equipment', 'EPSON PRINTER',                         NULL,                     400.00, 'good',    'available',   'ADMIN',                v_finance_id,   v_creator_id, NOW(), NOW()),

    -- ── DIRECTOR OFFICE ─────────────────────────────────────────────────────
    ('MMPZ0056',    'equipment', 'Panasonic Landline Handset',            '4HALM668478',             25.00, 'good',    'available',   'DIRECTOR OFFICE',      v_director_id,  v_creator_id, NOW(), NOW()),
    ('MMPZ0057',    'equipment', 'TP Link Wi-Fi modem',                   '216C544003631',           25.00, 'good',    'available',   'DIRECTOR OFFICE',      v_director_id,  v_creator_id, NOW(), NOW()),
    ('MMPZ0058',    'equipment', 'Panasonic Landline Handset',            '5HALM668478',             25.00, 'good',    'available',   'DIRECTOR OFFICE',      v_director_id,  v_creator_id, NOW(), NOW()),
    ('MMPZ0016',    'equipment', 'DESK',                                  NULL,                       0.00, 'good',    'available',   'DIRECTOR OFFICE',      v_director_id,  v_creator_id, NOW(), NOW()),
    ('MMPZ0017',    'equipment', 'SWIVEL CHAIR',                          NULL,                       0.00, 'damaged', 'maintenance', 'DIRECTOR OFFICE',      v_director_id,  v_creator_id, NOW(), NOW()),
    ('MMPZ-SCB-002','equipment', 'STEEL CABINET',                         NULL,                     200.00, 'good',    'available',   'DIRECTOR OFFICE',      v_director_id,  v_creator_id, NOW(), NOW()),
    ('MMPZ-EDB-001','equipment', 'Executive Desk brown',                  NULL,                     390.00, 'good',    'available',   'Director Office',      v_director_id,  v_creator_id, NOW(), NOW()),
    ('MMPZ-ROD-001','equipment', 'Regular Office desk brown',             NULL,                     195.00, 'good',    'available',   'Director Office',      v_director_id,  v_creator_id, NOW(), NOW()),
    ('MMPZ-ZHL-001','equipment', 'Z HP Laptop',                           '5CG12810YQ',             480.00, 'good',    'available',   'Director',             v_director_id,  v_creator_id, NOW(), NOW()),
    ('MMPZ-LLC-001','equipment', 'Lenovo laptop',                         'PW007996',              1500.00, 'good',    'available',   'DIRECTOR CHIOMVU',     v_director_id,  v_creator_id, NOW(), NOW()),
    ('MMPZ-DSB-001','equipment', 'Dust bin',                              NULL,                       7.00, 'good',    'available',   'Director Office',      v_director_id,  v_creator_id, NOW(), NOW()),
    ('MMPZ-NVC-001','equipment', 'Netted visitors chair',                 NULL,                      90.00, 'good',    'available',   'Directors Office',     v_director_id,  v_creator_id, NOW(), NOW()),
    ('MMPZ-NVC-002','equipment', 'Netted visitors chair',                 NULL,                      90.00, 'good',    'available',   'Directors Office',     v_director_id,  v_creator_id, NOW(), NOW()),

    -- ── YOUTH ROOM / PROGRAMMS / SITE / OTHER (Logistics) ───────────────────
    ('MMPZ0046',    'equipment', 'Konica Minolta Bizhub 223MFP PRINTER',  'A149041100891',         1500.00, 'good',    'available',   'YOUTH ROOM',           v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ0053',    'equipment', 'Sharp microwave',                        'EB00484520315C15110179', 219.00, 'good',    'available',   'YOUTH ROOM',           v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ0042',    'equipment', 'White Boarder 90mm x 120mm',            NULL,                       0.00, 'damaged', 'maintenance', 'YOUTH ROOM',           v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ0044',    'equipment', 'Comb bind binding machine',             'ZI05734P',                15.00, 'good',    'available',   'YOUTH ROOM',           v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ0079',    'equipment', 'MAC Diesel Generator',                  NULL,                    2700.00, 'good',    'available',   'SITE Ep',              v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-AB-001', 'equipment', 'Acer Big White',                        'DQBEBEA0010190082F3000', 760.00, 'good',    'available',   'YOUTH ROOM',           v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-CF-001', 'equipment', 'Capri deep fridge',                     'B122104785',             400.00, 'good',    'available',   'YOUTH ROOM',           v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-PT-001', 'equipment', 'PHILIPS TV',                            NULL,                       0.00, 'good',    'available',   'YOUTH ROOM',           v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-LML-001','equipment', 'Lenovo mini laptop',                    'SM-Y00ZNQYW',            150.00, 'good',    'available',   'PROGRAMMS',            v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-HPL-001','equipment', 'HP Laptop',                             'CND328155B',             800.00, 'good',    'available',   'PROGRAMMS SIQO',       v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-HPL-003','equipment', 'HP Laptop',                             'CND2064VKG',             800.00, 'good',    'available',   'PROGRAMMS KUMIRA',     v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-LNV-001','equipment', 'Levovo',                                'NXHNSEA00295012CE67600',   0.00, 'good',    'available',   'MLAUZI',               v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-LNV-002','equipment', 'LENOVO',                                NULL,                     670.00, 'good',    'available',   'PROGRAMMS FREDDY',     v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-Y6P-001','equipment', 'Y6 Prime Phone',                        NULL,                     180.00, 'good',    'available',   'PROGRAMMING RUMBI',    v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-Y6P-002','equipment', 'Y6 Prime Phone',                        NULL,                     180.00, 'good',    'available',   'PROGRAMMING BRENDO',   v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-SFB-001','equipment', 'Selfi-board',                           NULL,                      50.00, 'good',    'available',   'Programming',          v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-TSC-001','equipment', 'Three sitter couch orange',             NULL,                     240.00, 'good',    'available',   'Youth Room',           v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-CTB-001','equipment', 'Center Table',                          NULL,                     105.00, 'good',    'available',   'Youth Room',           v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-CTB-002','equipment', 'Center Table',                          NULL,                     105.00, 'good',    'available',   'Youth Room',           v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-YSC-001','equipment', 'Yellow shell chair',                    NULL,                     140.00, 'good',    'available',   'Youth Room',           v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-SLG-001','equipment', 'Snake and ladders game',                NULL,                     100.00, 'good',    'available',   'Youth room',           v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-STD-001','equipment', 'STUDENT DESK',                          NULL,                       0.00, 'good',    'available',   'YOUTH ROOM',           v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-OFD-001','equipment', 'OFFICE DESK',                           NULL,                       0.00, 'good',    'available',   'YOUTH ROOM',           v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-PLT-001','equipment', 'POOL TABLE',                            NULL,                     220.00, 'good',    'available',   'YOUTH ROOM',           v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-VCH-001','equipment', 'VISITORS CHAIR',                        NULL,                       0.00, 'damaged', 'maintenance', 'YOUTH ROOM',           v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-WSH-001','equipment', 'WOODEN SHELF',                          NULL,                       0.00, 'good',    'available',   'YOUTH ROOM',           v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-BWC-001','equipment', 'BLACK WOODEN CABINET',                  NULL,                     200.00, 'good',    'available',   'YOUTH ROOM',           v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-BNB-001','equipment', 'BIN BAGS',                              NULL,                      25.00, 'good',    'available',   'YOUTH ROOM',           v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-BNB-002','equipment', 'BIN BAGS',                              NULL,                      25.00, 'good',    'available',   'YOUTH ROOM',           v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-BNB-003','equipment', 'BIN BAGS',                              NULL,                      25.00, 'good',    'available',   'YOUTH ROOM',           v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-BNB-004','equipment', 'BIN BAGS',                              NULL,                      25.00, 'good',    'available',   'YOUTH ROOM',           v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-BNB-005','equipment', 'BIN BAGS',                              NULL,                      25.00, 'good',    'available',   'YOUTH ROOM',           v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-VBC-001','equipment', 'VISITORS BLACK CHAIR',                  NULL,                      80.00, 'good',    'available',   'PROGRAMMS',            v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-ODS-001','equipment', 'OFFICE DESK',                           NULL,                     200.00, 'good',    'available',   'PROGRAMMS',            v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-ODS-002','equipment', 'OFFICE DESK',                           NULL,                     200.00, 'good',    'available',   'PROGRAMMS',            v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-WSH-002','equipment', 'WOODEN SHELF',                          NULL,                     120.00, 'good',    'available',   'PROGRAMMS',            v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-WCA-001','equipment', 'WOODEN CABINET',                        NULL,                      75.00, 'good',    'available',   'PROGRAMMS',            v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-WCA-002','equipment', 'WOODEN CABINET',                        NULL,                      75.00, 'good',    'available',   'PROGRAMMS',            v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-6KD-001','equipment', '6 KG Dumbells',                         NULL,                      30.00, 'good',    'available',   'SITE',                 v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-6KD-002','equipment', '6 KG Dumbells',                         NULL,                      30.00, 'good',    'available',   'SITE',                 v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-5KD-001','equipment', '5 kg Dumbells',                         NULL,                      25.00, 'good',    'available',   'SITE',                 v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-5KD-002','equipment', '5 kg Dumbells',                         NULL,                      25.00, 'good',    'available',   'SITE',                 v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-4KD-001','equipment', '4 kg Dumbells',                         NULL,                      15.00, 'good',    'available',   'SITE',                 v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-4KD-002','equipment', '4 kg Dumbells',                         NULL,                      15.00, 'good',    'available',   'SITE',                 v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-GYM-001','equipment', 'Gym mat',                               NULL,                      10.00, 'good',    'available',   'SITE',                 v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-GYM-002','equipment', 'Gym mat',                               NULL,                      10.00, 'good',    'available',   'SITE',                 v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-GYM-003','equipment', 'Gym mat',                               NULL,                      10.00, 'good',    'available',   'SITE',                 v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-SKP-001','equipment', 'Skipping rope',                         NULL,                       5.00, 'good',    'available',   'SITE',                 v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-SKP-002','equipment', 'Skipping rope',                         NULL,                       5.00, 'good',    'available',   'SITE',                 v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-SKP-003','equipment', 'Skipping rope',                         NULL,                       5.00, 'good',    'available',   'SITE',                 v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-PEC-001','equipment', 'Portable examination couch',            NULL,                     290.00, 'good',    'available',   'SITE',                 v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-EDT-001','equipment', 'Emergency Drug Trolley',                NULL,                     320.00, 'good',    'available',   'SITE',                 v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-C4D-001','equipment', 'Cabinet - 4 drawer',                    NULL,                     250.00, 'good',    'available',   'SITE',                 v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-WTK-001','equipment', 'WATER TANKS',                           NULL,                     455.00, 'good',    'available',   'SITE',                 v_logistics_id, v_creator_id, NOW(), NOW()),

    -- ── BICYCLES (qty 12) ────────────────────────────────────────────────────
    ('MMPZ-BFC-001','equipment', 'BUFFALO BICYCLE',                       NULL,                    1800.00, 'good',    'available',   'CCF & SITE',           v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-BFC-002','equipment', 'BUFFALO BICYCLE',                       NULL,                    1800.00, 'good',    'available',   'CCF & SITE',           v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-BFC-003','equipment', 'BUFFALO BICYCLE',                       NULL,                    1800.00, 'good',    'available',   'CCF & SITE',           v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-BFC-004','equipment', 'BUFFALO BICYCLE',                       NULL,                    1800.00, 'good',    'available',   'CCF & SITE',           v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-BFC-005','equipment', 'BUFFALO BICYCLE',                       NULL,                    1800.00, 'good',    'available',   'CCF & SITE',           v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-BFC-006','equipment', 'BUFFALO BICYCLE',                       NULL,                    1800.00, 'good',    'available',   'CCF & SITE',           v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-BFC-007','equipment', 'BUFFALO BICYCLE',                       NULL,                    1800.00, 'good',    'available',   'CCF & SITE',           v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-BFC-008','equipment', 'BUFFALO BICYCLE',                       NULL,                    1800.00, 'good',    'available',   'CCF & SITE',           v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-BFC-009','equipment', 'BUFFALO BICYCLE',                       NULL,                    1800.00, 'good',    'available',   'CCF & SITE',           v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-BFC-010','equipment', 'BUFFALO BICYCLE',                       NULL,                    1800.00, 'good',    'available',   'CCF & SITE',           v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-BFC-011','equipment', 'BUFFALO BICYCLE',                       NULL,                    1800.00, 'good',    'available',   'CCF & SITE',           v_logistics_id, v_creator_id, NOW(), NOW()),
    ('MMPZ-BFC-012','equipment', 'BUFFALO BICYCLE',                       NULL,                    1800.00, 'good',    'available',   'CCF & SITE',           v_logistics_id, v_creator_id, NOW(), NOW()),

    -- ── MOTOR VEHICLE ────────────────────────────────────────────────────────
    ('MMPZ-NCV-001','vehicle',   'NISSAN CARAVAN NV 350',                 'AFV2384',              12850.00, 'good',    'available',   'DIRECTOR OFFICE',      v_director_id,  v_creator_id, NOW(), NOW())

    ON CONFLICT (asset_code) DO NOTHING;

    RAISE NOTICE 'Asset register seeded. Total assets now: %', (SELECT COUNT(*) FROM assets);
END $$;
