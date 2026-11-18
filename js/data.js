/**
 * Default Seed Data for Manufacturing & DBMS Operations
 * Matches the ER Diagram Entities and Relationships precisely:
 * 1. Customers (cust_id, cust_name, phone_no, email, address)
 * 2. Suppliers (supp_id, company_name, phone, address)
 * 3. Raw_Material (material_id, material_name, stock, unit_cost, supp_id)
 * 4. Work_Center (centre_id, centre_name, hourly_rate, status, location)
 * 5. Products (prod_id, prod_name, unit_price, stock, centre_id)
 * 6. Bill_of_Material (bom_id, prod_id, material_id, money)
 * 7. Production_Orders (order_id, prod_id, target, start_date, completion_date, status)
 * 8. Production_Logs (log_id, order_id, labour_hours, units_completed, updated_at)
 */

export const INITIAL_DATA = {
    customers: [
        {
            cust_id: "CUST-101",
            cust_name: "Apex Aerospace Corp",
            phone_no: "+1 (555) 234-8901",
            email: "procurement@apexaero.com",
            address: "742 Evergreen Terrace, Sector 4, Seattle, WA"
        },
        {
            cust_id: "CUST-102",
            cust_name: "Nexis Robotics Ltd",
            phone_no: "+1 (555) 876-5432",
            email: "contact@nexisrobotics.io",
            address: "120 Silicon Boulevard, Tech Park, Austin, TX"
        },
        {
            cust_id: "CUST-103",
            cust_name: "Vanguard Automotive",
            phone_no: "+1 (555) 432-1098",
            email: "orders@vanguardauto.de",
            address: "88 Industrial Way, Suite 400, Detroit, MI"
        },
        {
            cust_id: "CUST-104",
            cust_name: "Solaris Power Systems",
            phone_no: "+1 (555) 789-0123",
            email: "supply@solarispower.com",
            address: "550 Clean Energy Ave, Denver, CO"
        }
    ],

    suppliers: [
        {
            supp_id: "SUPP-01",
            company_name: "AlloyTech Metallurgy Inc.",
            phone: "+1 (800) 555-0199",
            address: "100 Steel Mill Road, Pittsburgh, PA"
        },
        {
            supp_id: "SUPP-02",
            company_name: "Quantum Semi Conductors",
            phone: "+1 (800) 555-8821",
            address: "42 Nanotech Way, San Jose, CA"
        },
        {
            supp_id: "SUPP-03",
            company_name: "Polymer Dynamics Global",
            phone: "+1 (800) 555-3412",
            address: "98 Polymer Ridge, Akron, OH"
        },
        {
            supp_id: "SUPP-04",
            company_name: "ElectroCore Components",
            phone: "+1 (800) 555-7740",
            address: "310 Circuit Drive, Phoenix, AZ"
        }
    ],

    raw_materials: [
        {
            material_id: "MAT-001",
            material_name: "Aerospace Grade Aluminum 7075",
            stock: 450,
            unit_cost: 38.50,
            supp_id: "SUPP-01"
        },
        {
            material_id: "MAT-002",
            material_name: "Silicon Microcontroller Unit (MCU-32)",
            stock: 1200,
            unit_cost: 14.20,
            supp_id: "SUPP-02"
        },
        {
            material_id: "MAT-003",
            material_name: "High-Temp Carbon Fiber Composite",
            stock: 180,
            unit_cost: 65.00,
            supp_id: "SUPP-03"
        },
        {
            material_id: "MAT-004",
            material_name: "Copper Induction Wire (100m Spool)",
            stock: 320,
            unit_cost: 22.80,
            supp_id: "SUPP-04"
        },
        {
            material_id: "MAT-005",
            material_name: "Reinforced Polymer Housing",
            stock: 850,
            unit_cost: 9.50,
            supp_id: "SUPP-03"
        }
    ],

    work_centers: [
        {
            centre_id: "WC-01",
            centre_name: "CNC Precision Machining Cell A",
            hourly_rate: 85.00,
            status: "Operational",
            location: "Building 1 - Bay 4"
        },
        {
            centre_id: "WC-02",
            centre_name: "SMT Electronics Assembly Line",
            hourly_rate: 110.00,
            status: "Operational",
            location: "Cleanroom 2 - Floor 1"
        },
        {
            centre_id: "WC-03",
            centre_name: "Robotic Welding & Chassis Integration",
            hourly_rate: 95.00,
            status: "Maintenance",
            location: "Building 2 - Heavy Bay"
        },
        {
            centre_id: "WC-04",
            centre_name: "Final QA & Laser Calibration Hub",
            hourly_rate: 75.00,
            status: "Operational",
            location: "Building 1 - Testing Suite"
        }
    ],

    products: [
        {
            prod_id: "PROD-101",
            prod_name: "Autonomous Drone Flight Controller v2",
            unit_price: 349.99,
            stock: 65,
            centre_id: "WC-02"
        },
        {
            prod_id: "PROD-102",
            prod_name: "High-Torque Brushless Servo Motor",
            unit_price: 189.50,
            stock: 140,
            centre_id: "WC-01"
        },
        {
            prod_id: "PROD-103",
            prod_name: "Industrial LiDAR Sensor Module",
            unit_price: 799.00,
            stock: 28,
            centre_id: "WC-04"
        },
        {
            prod_id: "PROD-104",
            prod_name: "Composite Robotic Arm Actuator",
            unit_price: 520.00,
            stock: 42,
            centre_id: "WC-03"
        }
    ],

    bill_of_materials: [
        {
            bom_id: "BOM-001",
            prod_id: "PROD-101",
            material_id: "MAT-002",
            money: 28.40 // 2x MCUs @ 14.20
        },
        {
            bom_id: "BOM-002",
            prod_id: "PROD-101",
            material_id: "MAT-005",
            money: 9.50 // 1x Polymer Housing
        },
        {
            bom_id: "BOM-003",
            prod_id: "PROD-102",
            material_id: "MAT-001",
            money: 38.50 // Aluminum casing
        },
        {
            bom_id: "BOM-004",
            prod_id: "PROD-102",
            material_id: "MAT-004",
            money: 45.60 // 2x Copper spools
        },
        {
            bom_id: "BOM-005",
            prod_id: "PROD-104",
            material_id: "MAT-003",
            money: 130.00 // 2x Carbon Fiber
        },
        {
            bom_id: "BOM-006",
            prod_id: "PROD-104",
            material_id: "MAT-001",
            money: 77.00 // 2x Aluminum 7075
        }
    ],

    production_orders: [
        {
            order_id: "ORD-901",
            prod_id: "PROD-101",
            target: 100,
            start_date: "2026-09-10",
            completion_date: "2026-09-30",
            status: "In Progress"
        },
        {
            order_id: "ORD-902",
            prod_id: "PROD-102",
            target: 250,
            start_date: "2026-09-01",
            completion_date: "2026-09-22",
            status: "Completed"
        },
        {
            order_id: "ORD-903",
            prod_id: "PROD-103",
            target: 50,
            start_date: "2026-09-20",
            completion_date: "2026-10-10",
            status: "In Progress"
        },
        {
            order_id: "ORD-904",
            prod_id: "PROD-104",
            target: 80,
            start_date: "2026-09-28",
            completion_date: "2026-10-25",
            status: "Pending"
        }
    ],

    production_logs: [
        {
            log_id: "LOG-5001",
            order_id: "ORD-901",
            labour_hours: 18.5,
            units_completed: 40,
            updated_at: "2026-09-15 16:30:00"
        },
        {
            log_id: "LOG-5002",
            order_id: "ORD-901",
            labour_hours: 14.0,
            units_completed: 30,
            updated_at: "2026-09-22 17:00:00"
        },
        {
            log_id: "LOG-5003",
            order_id: "ORD-902",
            labour_hours: 45.0,
            units_completed: 250,
            updated_at: "2026-09-22 12:00:00"
        },
        {
            log_id: "LOG-5004",
            order_id: "ORD-903",
            labour_hours: 8.0,
            units_completed: 15,
            updated_at: "2026-09-24 14:15:00"
        }
    ]
};
