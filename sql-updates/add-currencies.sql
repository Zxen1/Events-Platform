-- =====================================================
-- Currency Updates for International Website
-- =====================================================
-- 
-- WHAT THIS DOES:
-- 1. Removes the unused `options` column from fields table
-- 2. Adds 56 new world currencies to general_options table
--
-- BEFORE: Only 4 currencies (hardcoded in fields.options)
-- AFTER:  74 currencies (from general_options table)
-- =====================================================

-- Remove the options column from fields table (no longer needed)
-- Currency options now come from general_options table
ALTER TABLE `fields` DROP COLUMN `options`;

-- Add more international currencies to general_options
-- Starting after id 18 (last existing currency)

INSERT INTO `general_options` (`option_group`, `option_value`, `option_label`, `sort_order`, `is_active`) VALUES
-- Asia Pacific
('currency', 'CNY', 'Chinese Yuan', 19, 1),
('currency', 'KRW', 'South Korean Won', 20, 1),
('currency', 'TWD', 'Taiwan Dollar', 21, 1),
('currency', 'THB', 'Thai Baht', 22, 1),
('currency', 'PHP', 'Philippine Peso', 23, 1),
('currency', 'IDR', 'Indonesian Rupiah', 24, 1),
('currency', 'MYR', 'Malaysian Ringgit', 25, 1),
('currency', 'VND', 'Vietnamese Dong', 26, 1),

-- Middle East
('currency', 'AED', 'UAE Dirham', 27, 1),
('currency', 'SAR', 'Saudi Riyal', 28, 1),
('currency', 'QAR', 'Qatari Riyal', 29, 1),
('currency', 'KWD', 'Kuwaiti Dinar', 30, 1),
('currency', 'BHD', 'Bahraini Dinar', 31, 1),
('currency', 'OMR', 'Omani Rial', 32, 1),
('currency', 'ILS', 'Israeli Shekel', 33, 1),

-- Europe (additional)
('currency', 'CZK', 'Czech Koruna', 34, 1),
('currency', 'HUF', 'Hungarian Forint', 35, 1),
('currency', 'RON', 'Romanian Leu', 36, 1),
('currency', 'BGN', 'Bulgarian Lev', 37, 1),
('currency', 'HRK', 'Croatian Kuna', 38, 1),
('currency', 'ISK', 'Icelandic Krona', 39, 1),
('currency', 'RUB', 'Russian Ruble', 40, 1),
('currency', 'UAH', 'Ukrainian Hryvnia', 41, 1),
('currency', 'TRY', 'Turkish Lira', 42, 1),

-- Americas (additional)
('currency', 'CLP', 'Chilean Peso', 43, 1),
('currency', 'COP', 'Colombian Peso', 44, 1),
('currency', 'ARS', 'Argentine Peso', 45, 1),
('currency', 'PEN', 'Peruvian Sol', 46, 1),
('currency', 'UYU', 'Uruguayan Peso', 47, 1),
('currency', 'BOB', 'Bolivian Boliviano', 48, 1),
('currency', 'PYG', 'Paraguayan Guarani', 49, 1),
('currency', 'VES', 'Venezuelan Bolivar', 50, 1),
('currency', 'DOP', 'Dominican Peso', 51, 1),
('currency', 'JMD', 'Jamaican Dollar', 52, 1),
('currency', 'TTD', 'Trinidad Dollar', 53, 1),
('currency', 'GTQ', 'Guatemalan Quetzal', 54, 1),
('currency', 'CRC', 'Costa Rican Colon', 55, 1),
('currency', 'PAB', 'Panamanian Balboa', 56, 1),

-- Africa (additional)
('currency', 'NGN', 'Nigerian Naira', 57, 1),
('currency', 'EGP', 'Egyptian Pound', 58, 1),
('currency', 'KES', 'Kenyan Shilling', 59, 1),
('currency', 'GHS', 'Ghanaian Cedi', 60, 1),
('currency', 'TZS', 'Tanzanian Shilling', 61, 1),
('currency', 'UGX', 'Ugandan Shilling', 62, 1),
('currency', 'MAD', 'Moroccan Dirham', 63, 1),
('currency', 'TND', 'Tunisian Dinar', 64, 1),
('currency', 'XOF', 'West African CFA Franc', 65, 1),
('currency', 'XAF', 'Central African CFA Franc', 66, 1),

-- South Asia
('currency', 'PKR', 'Pakistani Rupee', 67, 1),
('currency', 'BDT', 'Bangladeshi Taka', 68, 1),
('currency', 'LKR', 'Sri Lankan Rupee', 69, 1),
('currency', 'NPR', 'Nepalese Rupee', 70, 1),
('currency', 'MMK', 'Myanmar Kyat', 71, 1),

-- Other
('currency', 'FJD', 'Fijian Dollar', 72, 1),
('currency', 'PGK', 'Papua New Guinean Kina', 73, 1),
('currency', 'XPF', 'CFP Franc', 74, 1);

-- =====================================================
-- Summary: This adds 56 new currencies for a total of 74 currencies
-- =====================================================
