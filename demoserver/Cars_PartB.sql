-- =============================================================
-- CPSC 332 - Project Part B
-- ABC Company - Online Used Car Management System
-- Full DDL + sample data + required views
-- Target: MySQL 8.x
-- =============================================================

 DROP DATABASE IF EXISTS Cars;
 CREATE DATABASE Cars;
 USE Cars;

-- =============================================================
-- 1. LOOKUP / REFERENCE TABLE
-- =============================================================
CREATE TABLE ZipCodeData (
    ZipCode      VARCHAR(20) PRIMARY KEY,
    City         VARCHAR(50) NOT NULL,
    State        VARCHAR(50) NOT NULL,
    CreatedStamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================
-- 2. ADDRESS  (3NF - city/state factored into ZipCodeData)
-- =============================================================
CREATE TABLE Address (
    AddressID    INT AUTO_INCREMENT PRIMARY KEY,
    StreetNo     VARCHAR(20)  NOT NULL,
    StreetName   VARCHAR(100) NOT NULL,
    ApartmentNo  VARCHAR(20),
    ZipCode      VARCHAR(20)  NOT NULL,
    CreatedStamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_address_zip FOREIGN KEY (ZipCode)
        REFERENCES ZipCodeData(ZipCode)
);

-- =============================================================
-- 3. USERINFO
--    Business rule 11-13: email login, full profile, password
--    complexity (8+ chars, upper, lower, digit, special)
-- =============================================================
CREATE TABLE UserInfo (
    UserID       INT AUTO_INCREMENT PRIMARY KEY,
    FirstName    VARCHAR(50)  NOT NULL,
    LastName     VARCHAR(50)  NOT NULL,
    Phone        VARCHAR(20),
    Email        VARCHAR(100) UNIQUE NOT NULL,
    Password     VARCHAR(255) NOT NULL,
    AddressID    INT,
    UserRole     ENUM('Buyer','Seller','Manager','Admin') NOT NULL,
    StoreID      INT NULL,                         -- staff/manager only
    CreatedStamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_address FOREIGN KEY (AddressID)
        REFERENCES Address(AddressID),
    CONSTRAINT chk_password_len  CHECK (CHAR_LENGTH(Password) >= 8),
    CONSTRAINT chk_password_upper CHECK (Password REGEXP '[A-Z]'),
    CONSTRAINT chk_password_lower CHECK (Password REGEXP '[a-z]'),
    CONSTRAINT chk_password_digit CHECK (Password REGEXP '[0-9]'),
    CONSTRAINT chk_password_spec  CHECK (Password REGEXP '[^A-Za-z0-9]')
);

-- =============================================================
-- 4. STORE
-- =============================================================
CREATE TABLE Store (
    StoreID      INT AUTO_INCREMENT PRIMARY KEY,
    StoreName    VARCHAR(100) NOT NULL,
    AddressID    INT NOT NULL,
    ManagerID    INT NOT NULL,
    CreatedStamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_store_address FOREIGN KEY (AddressID)
        REFERENCES Address(AddressID),
    CONSTRAINT fk_store_manager FOREIGN KEY (ManagerID)
        REFERENCES UserInfo(UserID)
);

-- circular FK: UserInfo.StoreID -> Store.StoreID
ALTER TABLE UserInfo
    ADD CONSTRAINT fk_user_store FOREIGN KEY (StoreID)
        REFERENCES Store(StoreID);

-- =============================================================
-- 5. VEHICLE
--    Business rules 4-9 enumerate fixed values - enforced via CHECK
-- =============================================================
CREATE TABLE Vehicle (
    VehicleID        INT AUTO_INCREMENT PRIMARY KEY,
    Brand            VARCHAR(50)  NOT NULL,
    Model            VARCHAR(50)  NOT NULL,
    Year             INT          NOT NULL,
    Mileage          INT          NOT NULL,
    Price            DECIMAL(10,2) NOT NULL,
    ExteriorColor    VARCHAR(30),
    InteriorColor    VARCHAR(30),
    SeatingCapacity  INT,
    VehicleCondition ENUM('certified pre-owned','no accidents','clean title','one owner') NOT NULL,
    BodyStyle        ENUM('sedan','SUV','truck','van','coupe','hatchback') NOT NULL,
    FuelType         ENUM('EV','PHEV','hybrid','gas','diesel','hydrogen')  NOT NULL,
    Drivetrain       ENUM('4WD','AWD','FWD','RWD') NOT NULL,
    Transmission     ENUM('automatic','CVT','manual') NOT NULL,
    MPG              INT,           -- gas / hybrid only
    RangeMiles       INT,           -- EV only
    StoreID          INT NOT NULL,
    CreatedStamp     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_vehicle_store FOREIGN KEY (StoreID)
        REFERENCES Store(StoreID),
    CONSTRAINT chk_year     CHECK (Year BETWEEN 1900 AND 2100),
    CONSTRAINT chk_mileage  CHECK (Mileage >= 0),
    CONSTRAINT chk_price    CHECK (Price > 0),
    CONSTRAINT chk_seats    CHECK (SeatingCapacity BETWEEN 1 AND 15)
);

-- =============================================================
-- 6. VEHICLE FEATURES (M:N)
-- =============================================================
CREATE TABLE VehicleFeature (
    FeatureID    INT AUTO_INCREMENT PRIMARY KEY,
    FeatureName  VARCHAR(50) UNIQUE NOT NULL,
    CreatedStamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE VehicleFeatMap (
    FeatureID    INT NOT NULL,
    VehicleID    INT NOT NULL,
    CreatedStamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (FeatureID, VehicleID),
    CONSTRAINT fk_vfm_feature FOREIGN KEY (FeatureID)
        REFERENCES VehicleFeature(FeatureID),
    CONSTRAINT fk_vfm_vehicle FOREIGN KEY (VehicleID)
        REFERENCES Vehicle(VehicleID)
);

-- =============================================================
-- 7. TRANSACTION
--    Business rule 15: price, purchase date, buyer, vehicle
-- =============================================================
CREATE TABLE Transactions (
    TransID      INT AUTO_INCREMENT PRIMARY KEY,
    BuyerID      INT NOT NULL,
    VehicleID    INT NOT NULL UNIQUE,   -- a vehicle is sold once
    SalePrice    DECIMAL(10,2) NOT NULL,
    PurchaseDate DATE NOT NULL,
    CreatedStamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tx_buyer   FOREIGN KEY (BuyerID)
        REFERENCES UserInfo(UserID),
    CONSTRAINT fk_tx_vehicle FOREIGN KEY (VehicleID)
        REFERENCES Vehicle(VehicleID),
    CONSTRAINT chk_sale_price CHECK (SalePrice > 0)
);

-- =============================================================
-- SAMPLE DATA
-- =============================================================

-- Zip codes
INSERT INTO ZipCodeData (ZipCode, City, State) VALUES
 ('92501','Riverside','CA'),
 ('92831','Fullerton','CA'),
 ('91761','Ontario','CA'),
 ('90001','Los Angeles','CA'),
 ('92602','Irvine','CA'),
 ('92101','San Diego','CA');

-- Addresses (1-4 = stores, 5-9 = managers, 10-19 = buyers/staff)
INSERT INTO Address (StreetNo, StreetName, ApartmentNo, ZipCode) VALUES
 ('100','Main St',       NULL, '92501'),  -- 1 store
 ('250','Commonwealth Ave', NULL, '92831'),-- 2 store
 ('500','Mission Blvd',   NULL, '91761'),  -- 3 store
 ('1500','Wilshire Blvd', NULL, '90001'),  -- 4 store
 ('11','Oak St',          'A',  '92501'),  -- 5 mgr Riverside
 ('22','Pine Ave',        NULL, '92831'),  -- 6 mgr Fullerton
 ('33','Cedar Ln',        '12', '91761'),  -- 7 mgr Ontario
 ('44','Maple Dr',        NULL, '90001'),  -- 8 mgr LA
 ('55','Birch Rd',        NULL, '92602'),  -- 9 admin
 ('60','Elm St',          NULL, '92501'),  -- 10 buyer
 ('70','Walnut St',       '3',  '92831'),  -- 11 buyer
 ('80','Spruce Ave',      NULL, '91761'),  -- 12 buyer
 ('90','Aspen Way',       NULL, '90001'),  -- 13 buyer
 ('101','Sunset Blvd',    NULL, '92602'),  -- 14 buyer
 ('202','Ocean Dr',       '5',  '92101'),  -- 15 buyer
 ('303','Beach Rd',       NULL, '92501'),  -- 16 buyer
 ('404','Hillcrest Ave',  NULL, '92831'),  -- 17 buyer
 ('505','Park Pl',        NULL, '91761'),  -- 18 seller
 ('606','Lakeview Dr',    NULL, '90001');  -- 19 seller

-- Users -- managers and admin first so we can reference them in Store
INSERT INTO UserInfo (FirstName,LastName,Phone,Email,Password,AddressID,UserRole,StoreID) VALUES
 ('Alice','Nguyen','714-555-1001','alice.mgr@abc.com',  'Manager#1A',5,'Manager',NULL),  -- 1
 ('Brian','Patel','714-555-1002','brian.mgr@abc.com',   'Manager#1B',6,'Manager',NULL),  -- 2
 ('Carla','Smith','909-555-1003','carla.mgr@abc.com',   'Manager#1C',7,'Manager',NULL),  -- 3
 ('Derek','Lopez','213-555-1004','derek.mgr@abc.com',   'Manager#1D',8,'Manager',NULL),  -- 4
 ('Admin', 'Admin', '000-000-0000','admin@abc.com',  'Admin123',9,'Admin',  NULL); -- 5

-- Stores (each managed by one of the managers above)
INSERT INTO Store (StoreName, AddressID, ManagerID) VALUES
 ('ABC Riverside', 1, 1),  -- 1
 ('ABC Fullerton', 2, 2),  -- 2
 ('ABC Ontario',   3, 3),  -- 3
 ('ABC LA',        4, 4);  -- 4

-- Now backfill StoreID on the manager rows
UPDATE UserInfo SET StoreID = 1 WHERE UserID = 1;
UPDATE UserInfo SET StoreID = 2 WHERE UserID = 2;
UPDATE UserInfo SET StoreID = 3 WHERE UserID = 3;
UPDATE UserInfo SET StoreID = 4 WHERE UserID = 4;

-- Sellers (staff that work at a store)
INSERT INTO UserInfo (FirstName,LastName,Phone,Email,Password,AddressID,UserRole,StoreID) VALUES
 ('Frank','Garcia','909-555-3001','frank.sell@abc.com','Seller$01',18,'Seller',3),  -- 6
 ('Gina', 'Kim',   '213-555-3002','gina.sell@abc.com', 'Seller$02',19,'Seller',4);  -- 7

-- Buyers
INSERT INTO UserInfo (FirstName,LastName,Phone,Email,Password,AddressID,UserRole,StoreID) VALUES
 ('Henry','Adams', '951-555-4001','henry@example.com', 'Buyer#001',10,'Buyer',NULL), -- 8
 ('Ivy',  'Brown', '714-555-4002','ivy@example.com',   'Buyer#002',11,'Buyer',NULL), -- 9
 ('Jake', 'Cole',  '909-555-4003','jake@example.com',  'Buyer#003',12,'Buyer',NULL), -- 10
 ('Kara', 'Davis', '213-555-4004','kara@example.com',  'Buyer#004',13,'Buyer',NULL), -- 11
 ('Liam', 'Evans', '949-555-4005','liam@example.com',  'Buyer#005',14,'Buyer',NULL), -- 12
 ('Mia',  'Fox',   '619-555-4006','mia@example.com',   'Buyer#006',15,'Buyer',NULL), -- 13
 ('Noah', 'Green', '951-555-4007','noah@example.com',  'Buyer#007',16,'Buyer',NULL), -- 14
 ('Olive','Hill',  '714-555-4008','olive@example.com', 'Buyer#008',17,'Buyer',NULL), -- 15
 ('Paul', 'Irwin', '951-555-4009','paul@example.com',  'Buyer#009',10,'Buyer',NULL), -- 16
 ('Quinn','Jones', '714-555-4010','quinn@example.com', 'Buyer#010',11,'Buyer',NULL), -- 17
 ('Rita', 'Klein', '909-555-4011','rita@example.com',  'Buyer#011',12,'Buyer',NULL), -- 18
 ('Sam',  'Lee',   '213-555-4012','sam@example.com',   'Buyer#012',13,'Buyer',NULL), -- 19
 ('Tara', 'Moore', '949-555-4013','tara@example.com',  'Buyer#013',14,'Buyer',NULL), -- 20
 ('Uma',  'Nash',  '619-555-4014','uma@example.com',   'Buyer#014',15,'Buyer',NULL), -- 21
 ('Victor','Ortiz','951-555-4015','victor@example.com','Buyer#015',16,'Buyer',NULL), -- 22
 ('Wendy','Park',  '714-555-4016','wendy@example.com', 'Buyer#016',17,'Buyer',NULL), -- 23
 ('Xander','Quinn','909-555-4017','xander@example.com','Buyer#017',10,'Buyer',NULL), -- 24
 ('Yara', 'Rios',  '213-555-4018','yara@example.com',  'Buyer#018',11,'Buyer',NULL), -- 25
 ('Zack', 'Stone', '949-555-4019','zack@example.com',  'Buyer#019',12,'Buyer',NULL), -- 26
 ('Amy',  'Tate',  '619-555-4020','amy@example.com',   'Buyer#020',13,'Buyer',NULL), -- 27
 ('Ben',  'Ueda',  '951-555-4021','ben@example.com',   'Buyer#021',14,'Buyer',NULL), -- 28
 ('Cleo', 'Vega',  '714-555-4022','cleo@example.com',  'Buyer#022',15,'Buyer',NULL), -- 29
 ('Drew', 'Wong',  '909-555-4023','drew@example.com',  'Buyer#023',16,'Buyer',NULL), -- 30
 ('Eli',  'Xu',    '213-555-4024','eli@example.com',   'Buyer#024',17,'Buyer',NULL), -- 31
 ('Faye', 'Young', '949-555-4025','faye@example.com',  'Buyer#025',10,'Buyer',NULL), -- 32
 ('Gus',  'Zhao',  '619-555-4026','gus@example.com',   'Buyer#026',11,'Buyer',NULL), -- 33
 ('Hana', 'Allen', '951-555-4027','hana@example.com',  'Buyer#027',12,'Buyer',NULL), -- 34
 ('Ian',  'Baker', '714-555-4028','ian@example.com',   'Buyer#028',13,'Buyer',NULL), -- 35
 ('Jill', 'Cruz',  '909-555-4029','jill@example.com',  'Buyer#029',14,'Buyer',NULL), -- 36
 ('Kyle', 'Diaz',  '213-555-4030','kyle@example.com',  'Buyer#030',15,'Buyer',NULL), -- 37
 ('Lana', 'Ellis', '949-555-4031','lana@example.com',  'Buyer#031',16,'Buyer',NULL), -- 38
 ('Mike', 'Faulk', '619-555-4032','mike@example.com',  'Buyer#032',17,'Buyer',NULL), -- 39
 ('Nina', 'Goss',  '951-555-4033','nina@example.com',  'Buyer#033',10,'Buyer',NULL); -- 40

-- =============================================================
-- VEHICLES
-- =============================================================
-- Store 1 (Riverside) - 35 vehicles to drive >30 sales/month for view 5
INSERT INTO Vehicle
 (Brand,Model,Year,Mileage,Price,ExteriorColor,InteriorColor,SeatingCapacity,
  VehicleCondition,BodyStyle,FuelType,Drivetrain,Transmission,MPG,RangeMiles,StoreID) VALUES
 ('Toyota','Camry',     2022,25000,21999.00,'White','Black',5,'certified pre-owned','sedan','gas','FWD','automatic',32,NULL,1),
 ('Honda','Accord',     2021,30000,19999.00,'Black','Tan',  5,'no accidents','sedan','gas','FWD','automatic',30,NULL,1),
 ('Tesla','Model 3',    2023,12000,38999.00,'Red','Black',  5,'one owner','sedan','EV','RWD','automatic',NULL,272,1),
 ('Ford','F-150',       2020,45000,28999.00,'Blue','Gray',  5,'clean title','truck','gas','4WD','automatic',22,NULL,1),
 ('Chevy','Silverado',  2019,60000,25999.00,'Silver','Black',5,'no accidents','truck','gas','4WD','automatic',20,NULL,1),
 ('Toyota','RAV4',      2022,22000,26999.00,'Gray','Black', 5,'certified pre-owned','SUV','hybrid','AWD','CVT',40,NULL,1),
 ('Honda','CR-V',       2021,28000,24999.00,'White','Black',5,'one owner','SUV','gas','AWD','CVT',28,NULL,1),
 ('Jeep','Wrangler',    2020,35000,29999.00,'Green','Black',5,'clean title','SUV','gas','4WD','manual',19,NULL,1),
 ('Ford','Mustang',     2019,40000,22999.00,'Yellow','Black',4,'no accidents','coupe','gas','RWD','manual',25,NULL,1),
 ('BMW','M4',           2021,18000,55999.00,'Black','Red',  4,'certified pre-owned','coupe','gas','RWD','automatic',24,NULL,1),
 ('Honda','Civic',      2022,15000,18999.00,'Red','Black',  5,'one owner','hatchback','gas','FWD','CVT',33,NULL,1),
 ('Toyota','Prius',     2021,32000,21999.00,'Silver','Gray',5,'clean title','hatchback','hybrid','FWD','CVT',54,NULL,1),
 ('Chrysler','Pacifica',2020,38000,23999.00,'White','Tan',  7,'no accidents','van','gas','FWD','automatic',22,NULL,1),
 ('Honda','Odyssey',    2021,29000,28999.00,'Black','Gray', 8,'certified pre-owned','van','gas','FWD','automatic',22,NULL,1),
 ('Toyota','Sienna',    2022,21000,32999.00,'Blue','Black', 7,'one owner','van','hybrid','AWD','CVT',36,NULL,1),
 ('Nissan','Altima',    2020,42000,16999.00,'White','Black',5,'clean title','sedan','gas','FWD','CVT',31,NULL,1),
 ('Hyundai','Sonata',   2021,33000,18999.00,'Gray','Black', 5,'no accidents','sedan','gas','FWD','automatic',32,NULL,1),
 ('Kia','Telluride',    2022,19000,38999.00,'Black','Black',8,'certified pre-owned','SUV','gas','AWD','automatic',23,NULL,1),
 ('Subaru','Outback',   2021,27000,26999.00,'Green','Tan',  5,'one owner','SUV','gas','AWD','CVT',29,NULL,1),
 ('Ford','Ranger',      2020,48000,22999.00,'Red','Black',  5,'clean title','truck','gas','4WD','automatic',23,NULL,1),
 ('Toyota','Tacoma',    2019,55000,24999.00,'Silver','Gray',5,'no accidents','truck','gas','4WD','automatic',22,NULL,1),
 ('Tesla','Model Y',    2023,11000,46999.00,'White','Black',5,'one owner','SUV','EV','AWD','automatic',NULL,330,1),
 ('Audi','A4',          2021,24000,29999.00,'Black','Black',5,'certified pre-owned','sedan','gas','AWD','automatic',27,NULL,1),
 ('Mazda','3',          2022,18000,20999.00,'Red','Black',  5,'one owner','hatchback','gas','FWD','automatic',32,NULL,1),
 ('VW','Golf',          2020,36000,18999.00,'Blue','Black', 5,'no accidents','hatchback','gas','FWD','manual',31,NULL,1),
 ('Porsche','911',      2018,32000,79999.00,'Silver','Black',4,'clean title','coupe','gas','RWD','automatic',22,NULL,1),
 ('Dodge','Challenger', 2019,41000,27999.00,'Orange','Black',4,'no accidents','coupe','gas','RWD','automatic',22,NULL,1),
 ('Chevy','Bolt',       2021,22000,21999.00,'White','Black',5,'one owner','hatchback','EV','FWD','automatic',NULL,259,1),
 ('Nissan','Leaf',      2020,30000,15999.00,'Blue','Gray',  5,'clean title','hatchback','EV','FWD','automatic',NULL,150,1),
 ('Hyundai','Ioniq 5',  2023,8000, 41999.00,'Gray','Black', 5,'certified pre-owned','SUV','EV','AWD','automatic',NULL,303,1),
 ('Toyota','Highlander',2021,26000,32999.00,'White','Tan',  7,'one owner','SUV','hybrid','AWD','CVT',35,NULL,1),
 ('Ford','Explorer',    2020,39000,27999.00,'Black','Black',7,'no accidents','SUV','gas','AWD','automatic',24,NULL,1),
 ('GMC','Sierra',       2019,52000,29999.00,'Red','Black',  5,'clean title','truck','diesel','4WD','automatic',26,NULL,1),
 ('Ram','1500',         2021,31000,33999.00,'Silver','Black',5,'certified pre-owned','truck','gas','4WD','automatic',22,NULL,1),
 ('Toyota','Corolla',   2022,19000,17999.00,'White','Black',5,'one owner','sedan','gas','FWD','CVT',35,NULL,1);

-- Store 2 (Fullerton) - 10 vehicles
INSERT INTO Vehicle
 (Brand,Model,Year,Mileage,Price,ExteriorColor,InteriorColor,SeatingCapacity,
  VehicleCondition,BodyStyle,FuelType,Drivetrain,Transmission,MPG,RangeMiles,StoreID) VALUES
 ('Toyota','Camry',  2021,28000,20999.00,'Silver','Black',5,'no accidents','sedan','gas','FWD','automatic',32,NULL,2),
 ('Honda','Civic',   2022,16000,19999.00,'Blue','Black',  5,'one owner','sedan','gas','FWD','CVT',33,NULL,2),
 ('Tesla','Model S', 2022,15000,69999.00,'Black','White', 5,'certified pre-owned','sedan','EV','AWD','automatic',NULL,396,2),
 ('Ford','F-150',    2021,32000,32999.00,'White','Tan',   5,'clean title','truck','gas','4WD','automatic',22,NULL,2),
 ('Honda','CR-V',    2022,21000,26999.00,'Red','Black',   5,'one owner','SUV','hybrid','AWD','CVT',38,NULL,2),
 ('Toyota','RAV4',   2021,29000,25999.00,'Black','Gray',  5,'no accidents','SUV','gas','AWD','automatic',28,NULL,2),
 ('Mazda','MX-5',    2020,18000,25999.00,'Red','Black',   2,'certified pre-owned','coupe','gas','RWD','manual',30,NULL,2),
 ('VW','GTI',        2021,22000,28999.00,'Gray','Black',  5,'one owner','hatchback','gas','FWD','automatic',28,NULL,2),
 ('Chrysler','Pacifica',2022,15000,34999.00,'Silver','Black',7,'certified pre-owned','van','PHEV','FWD','automatic',82,32,2),
 ('Hyundai','Kona EV', 2022,12000,27999.00,'Blue','Black',5,'one owner','SUV','EV','FWD','automatic',NULL,258,2);

-- Store 3 (Ontario) - 8 vehicles
INSERT INTO Vehicle
 (Brand,Model,Year,Mileage,Price,ExteriorColor,InteriorColor,SeatingCapacity,
  VehicleCondition,BodyStyle,FuelType,Drivetrain,Transmission,MPG,RangeMiles,StoreID) VALUES
 ('Nissan','Altima',  2020,40000,16999.00,'White','Black',5,'clean title','sedan','gas','FWD','CVT',31,NULL,3),
 ('Subaru','Forester',2021,28000,24999.00,'Green','Black',5,'no accidents','SUV','gas','AWD','CVT',29,NULL,3),
 ('Toyota','Tacoma',  2020,38000,27999.00,'Silver','Gray',5,'one owner','truck','gas','4WD','automatic',22,NULL,3),
 ('Honda','Pilot',    2021,30000,32999.00,'Black','Tan',  8,'certified pre-owned','SUV','gas','AWD','automatic',22,NULL,3),
 ('Kia','Soul',       2022,18000,18999.00,'Yellow','Black',5,'one owner','hatchback','gas','FWD','automatic',31,NULL,3),
 ('Ford','Bronco',    2022,15000,38999.00,'Blue','Black',  5,'certified pre-owned','SUV','gas','4WD','automatic',20,NULL,3),
 ('Toyota','Sienna',  2021,26000,30999.00,'White','Tan',  8,'no accidents','van','hybrid','FWD','CVT',36,NULL,3),
 ('Tesla','Model 3',  2022,14000,36999.00,'Black','Black',5,'certified pre-owned','sedan','EV','RWD','automatic',NULL,272,3);

-- Store 4 (LA) - 8 vehicles
INSERT INTO Vehicle
 (Brand,Model,Year,Mileage,Price,ExteriorColor,InteriorColor,SeatingCapacity,
  VehicleCondition,BodyStyle,FuelType,Drivetrain,Transmission,MPG,RangeMiles,StoreID) VALUES
 ('BMW','3 Series',   2021,22000,33999.00,'Black','Black',5,'certified pre-owned','sedan','gas','RWD','automatic',26,NULL,4),
 ('Mercedes','C-Class',2021,25000,36999.00,'White','Tan', 5,'one owner','sedan','gas','RWD','automatic',25,NULL,4),
 ('Audi','Q5',        2022,18000,39999.00,'Gray','Black', 5,'certified pre-owned','SUV','gas','AWD','automatic',24,NULL,4),
 ('Lexus','RX',       2021,28000,42999.00,'Silver','Tan', 5,'no accidents','SUV','hybrid','AWD','CVT',31,NULL,4),
 ('Porsche','Cayenne',2020,30000,55999.00,'Black','Red',  5,'clean title','SUV','gas','AWD','automatic',21,NULL,4),
 ('Tesla','Model X',  2022,16000,79999.00,'White','Black',7,'certified pre-owned','SUV','EV','AWD','automatic',NULL,348,4),
 ('Ford','Mustang Mach-E',2022,14000,42999.00,'Red','Black',5,'one owner','SUV','EV','AWD','automatic',NULL,300,4),
 ('Chevy','Corvette', 2020,20000,62999.00,'Yellow','Black',2,'no accidents','coupe','gas','RWD','automatic',19,NULL,4);

-- =============================================================
-- VEHICLE FEATURES
-- =============================================================
INSERT INTO VehicleFeature (FeatureName) VALUES
 ('backup camera'),('navigation'),('moonroof'),
 ('parking sensors'),('third row seating'),('tow hitch');

-- Map a few features to a sample of vehicles
INSERT INTO VehicleFeatMap (FeatureID, VehicleID) VALUES
 (1,1),(2,1),(3,1),
 (1,2),(4,2),
 (1,3),(2,3),(3,3),(4,3),
 (1,4),(6,4),(5,4),
 (1,5),(6,5),
 (1,6),(2,6),(3,6),
 (1,7),(5,7),
 (1,8),(6,8),
 (1,9),(2,9),
 (1,10),(2,10),(3,10),(4,10),
 (1,14),(5,14),
 (1,15),(5,15),(2,15),
 (1,22),(2,22),(3,22),
 (1,30),(2,30),(3,30),(4,30),
 (1,36),(2,36),(3,36),
 (1,40),(5,40),(6,40),
 (1,46),(2,46),(3,46),(4,46);

-- =============================================================
-- TRANSACTIONS
--   Store 1: 32 sales in current month (drives view 5)
--   Other stores: a smaller number of sales spread across months
-- =============================================================

-- 32 transactions for Store 1 (vehicles 1-32) in the current month
SET @cm := DATE_FORMAT(CURDATE(), '%Y-%m-01');

INSERT INTO Transactions (BuyerID,VehicleID,SalePrice,PurchaseDate) VALUES
 (8, 1, 21500.00, DATE_ADD(@cm, INTERVAL 1  DAY)),
 (9, 2, 19500.00, DATE_ADD(@cm, INTERVAL 1  DAY)),
 (10,3, 38000.00, DATE_ADD(@cm, INTERVAL 2  DAY)),
 (11,4, 28500.00, DATE_ADD(@cm, INTERVAL 2  DAY)),
 (12,5, 25500.00, DATE_ADD(@cm, INTERVAL 3  DAY)),
 (13,6, 26500.00, DATE_ADD(@cm, INTERVAL 3  DAY)),
 (14,7, 24500.00, DATE_ADD(@cm, INTERVAL 4  DAY)),
 (15,8, 29500.00, DATE_ADD(@cm, INTERVAL 4  DAY)),
 (16,9, 22500.00, DATE_ADD(@cm, INTERVAL 5  DAY)),
 (17,10,55000.00, DATE_ADD(@cm, INTERVAL 5  DAY)),
 (18,11,18500.00, DATE_ADD(@cm, INTERVAL 6  DAY)),
 (19,12,21500.00, DATE_ADD(@cm, INTERVAL 6  DAY)),
 (20,13,23500.00, DATE_ADD(@cm, INTERVAL 7  DAY)),
 (21,14,28500.00, DATE_ADD(@cm, INTERVAL 7  DAY)),
 (22,15,32500.00, DATE_ADD(@cm, INTERVAL 8  DAY)),
 (23,16,16500.00, DATE_ADD(@cm, INTERVAL 8  DAY)),
 (24,17,18500.00, DATE_ADD(@cm, INTERVAL 9  DAY)),
 (25,18,38500.00, DATE_ADD(@cm, INTERVAL 9  DAY)),
 (26,19,26500.00, DATE_ADD(@cm, INTERVAL 10 DAY)),
 (27,20,22500.00, DATE_ADD(@cm, INTERVAL 10 DAY)),
 (28,21,24500.00, DATE_ADD(@cm, INTERVAL 11 DAY)),
 (29,22,46500.00, DATE_ADD(@cm, INTERVAL 11 DAY)),
 (30,23,29500.00, DATE_ADD(@cm, INTERVAL 12 DAY)),
 (31,24,20500.00, DATE_ADD(@cm, INTERVAL 12 DAY)),
 (32,25,18500.00, DATE_ADD(@cm, INTERVAL 13 DAY)),
 (33,26,79000.00, DATE_ADD(@cm, INTERVAL 13 DAY)),
 (34,27,27500.00, DATE_ADD(@cm, INTERVAL 14 DAY)),
 (35,28,21500.00, DATE_ADD(@cm, INTERVAL 14 DAY)),
 (36,29,15500.00, DATE_ADD(@cm, INTERVAL 15 DAY)),
 (37,30,41500.00, DATE_ADD(@cm, INTERVAL 15 DAY)),
 (38,31,32500.00, DATE_ADD(@cm, INTERVAL 16 DAY)),
 (39,32,27500.00, DATE_ADD(@cm, INTERVAL 16 DAY));

-- A handful of older sales for Store 2/3/4 (won't trigger view 5)
INSERT INTO Transactions (BuyerID,VehicleID,SalePrice,PurchaseDate) VALUES
 (8, 36, 20500.00, DATE_SUB(CURDATE(), INTERVAL 45 DAY)),
 (9, 37, 19500.00, DATE_SUB(CURDATE(), INTERVAL 40 DAY)),
 (10,38, 68000.00, DATE_SUB(CURDATE(), INTERVAL 60 DAY)),
 (11,39, 32500.00, DATE_SUB(CURDATE(), INTERVAL 25 DAY)),
 (12,40, 26500.00, DATE_SUB(CURDATE(), INTERVAL 5  DAY)),
 (13,46, 16500.00, DATE_SUB(CURDATE(), INTERVAL 70 DAY)),
 (14,47, 24500.00, DATE_SUB(CURDATE(), INTERVAL 50 DAY)),
 (15,48, 27500.00, DATE_SUB(CURDATE(), INTERVAL 30 DAY)),
 (16,54, 33500.00, DATE_SUB(CURDATE(), INTERVAL 20 DAY)),
 (17,55, 36500.00, DATE_SUB(CURDATE(), INTERVAL 15 DAY)),
 (18,56, 39500.00, DATE_SUB(CURDATE(), INTERVAL 10 DAY)),
 (19,57, 42500.00, DATE_SUB(CURDATE(), INTERVAL 5  DAY));

-- =============================================================
-- VIEWS
-- =============================================================

-- View 1: cars sold in the CURRENT month, grouped by body type
CREATE OR REPLACE VIEW MonthlySalesByBodyType AS
SELECT
    s.StoreID,
    s.StoreName,
    CONCAT_WS(' ', a.StreetNo, a.StreetName,
             IF(a.ApartmentNo IS NULL,'',CONCAT('#',a.ApartmentNo)),
             z.City, z.State, a.ZipCode) AS StoreAddress,
    CONCAT(m.FirstName,' ',m.LastName)   AS ManagerName,
    v.BodyStyle,
    COUNT(t.TransID) AS CarsSoldThisMonth
FROM Store s
JOIN Address a       ON s.AddressID = a.AddressID
JOIN ZipCodeData z   ON a.ZipCode   = z.ZipCode
JOIN UserInfo m      ON s.ManagerID = m.UserID
JOIN Vehicle v       ON v.StoreID   = s.StoreID
JOIN Transactions t  ON t.VehicleID = v.VehicleID
WHERE YEAR(t.PurchaseDate)  = YEAR(CURDATE())
  AND MONTH(t.PurchaseDate) = MONTH(CURDATE())
GROUP BY s.StoreID, v.BodyStyle;

-- View 2: vehicles CURRENTLY AVAILABLE, grouped by body type
--         (available = no transaction record yet)
CREATE OR REPLACE VIEW AvailableInventoryByBodyType AS
SELECT
    s.StoreID,
    s.StoreName,
    CONCAT_WS(' ', a.StreetNo, a.StreetName,
             IF(a.ApartmentNo IS NULL,'',CONCAT('#',a.ApartmentNo)),
             z.City, z.State, a.ZipCode) AS StoreAddress,
    CONCAT(m.FirstName,' ',m.LastName)   AS ManagerName,
    v.BodyStyle,
    COUNT(v.VehicleID) AS AvailableVehicles
FROM Store s
JOIN Address a      ON s.AddressID = a.AddressID
JOIN ZipCodeData z  ON a.ZipCode   = z.ZipCode
JOIN UserInfo m     ON s.ManagerID = m.UserID
JOIN Vehicle v      ON v.StoreID   = s.StoreID
LEFT JOIN Transactions t ON t.VehicleID = v.VehicleID
WHERE t.TransID IS NULL
GROUP BY s.StoreID, v.BodyStyle;

-- View 3: stores that sold MORE THAN 30 cars in any single month
CREATE OR REPLACE VIEW HighPerformingStores AS
SELECT
    s.StoreID,
    s.StoreName,
    CONCAT_WS(' ', a.StreetNo, a.StreetName,
             IF(a.ApartmentNo IS NULL,'',CONCAT('#',a.ApartmentNo)),
             z.City, z.State, a.ZipCode) AS StoreAddress,
    CONCAT(m.FirstName,' ',m.LastName)   AS ManagerName,
    YEAR(t.PurchaseDate)  AS SaleYear,
    MONTH(t.PurchaseDate) AS SaleMonth,
    COUNT(t.TransID)      AS TotalCarsSold
FROM Store s
JOIN Address a      ON s.AddressID = a.AddressID
JOIN ZipCodeData z  ON a.ZipCode   = z.ZipCode
JOIN UserInfo m     ON s.ManagerID = m.UserID
JOIN Vehicle v      ON v.StoreID   = s.StoreID
JOIN Transactions t ON t.VehicleID = v.VehicleID
GROUP BY s.StoreID, YEAR(t.PurchaseDate), MONTH(t.PurchaseDate)
HAVING COUNT(t.TransID) > 30;

 SELECT * FROM MonthlySalesByBodyType;
 SELECT * FROM AvailableInventoryByBodyType;
 SELECT * FROM HighPerformingStores;
