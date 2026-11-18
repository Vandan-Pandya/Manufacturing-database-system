-- ==========================================================
-- DBMS Project - Manufacturing & Production Management System
-- Schema Definition derived from ER Diagram
-- ==========================================================

-- 1. Customers Entity
CREATE TABLE IF NOT EXISTS Customers (
    cust_id VARCHAR(20) PRIMARY KEY,
    cust_name VARCHAR(100) NOT NULL,
    phone_no VARCHAR(20),
    email VARCHAR(100),
    address TEXT
);

-- 2. Suppliers Entity
CREATE TABLE IF NOT EXISTS Suppliers (
    supp_id VARCHAR(20) PRIMARY KEY,
    company_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    address TEXT
);

-- 3. Raw Material Entity (Supplied by Suppliers)
CREATE TABLE IF NOT EXISTS Raw_Material (
    material_id VARCHAR(20) PRIMARY KEY,
    material_name VARCHAR(100) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    unit_cost DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    supp_id VARCHAR(20),
    FOREIGN KEY (supp_id) REFERENCES Suppliers(supp_id) ON DELETE SET NULL
);

-- 4. Work Center Entity
CREATE TABLE IF NOT EXISTS Work_Center (
    centre_id VARCHAR(20) PRIMARY KEY,
    centre_name VARCHAR(100) NOT NULL,
    hourly_rate DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    status ENUM('Operational', 'Maintenance', 'Idle', 'Offline') DEFAULT 'Operational',
    location VARCHAR(100)
);

-- 5. Products Entity (Manufactured by Work Center)
CREATE TABLE IF NOT EXISTS Products (
    prod_id VARCHAR(20) PRIMARY KEY,
    prod_name VARCHAR(100) NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    stock INT NOT NULL DEFAULT 0,
    centre_id VARCHAR(20),
    FOREIGN KEY (centre_id) REFERENCES Work_Center(centre_id) ON DELETE SET NULL
);

-- 6. Bill of Material (BOM) Entity (Associates Products & Raw Materials)
CREATE TABLE IF NOT EXISTS Bill_of_Material (
    bom_id VARCHAR(20) PRIMARY KEY,
    prod_id VARCHAR(20) NOT NULL,
    material_id VARCHAR(20) NOT NULL,
    money DECIMAL(10, 2) NOT NULL DEFAULT 0.00, -- cost or quantity allocation
    FOREIGN KEY (prod_id) REFERENCES Products(prod_id) ON DELETE CASCADE,
    FOREIGN KEY (material_id) REFERENCES Raw_Material(material_id) ON DELETE CASCADE
);

-- 7. Production Orders Entity (Scheduled for Products)
CREATE TABLE IF NOT EXISTS Production_Orders (
    order_id VARCHAR(20) PRIMARY KEY,
    prod_id VARCHAR(20) NOT NULL,
    target INT NOT NULL,
    start_date DATE NOT NULL,
    completion_date DATE,
    status ENUM('Pending', 'In Progress', 'Quality Check', 'Completed', 'Cancelled') DEFAULT 'Pending',
    FOREIGN KEY (prod_id) REFERENCES Products(prod_id) ON DELETE CASCADE
);

-- 8. Production Logs Entity (Tracks Production Orders)
CREATE TABLE IF NOT EXISTS Production_Logs (
    log_id VARCHAR(20) PRIMARY KEY,
    order_id VARCHAR(20) NOT NULL,
    labour_hours DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
    units_completed INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES Production_Orders(order_id) ON DELETE CASCADE
);