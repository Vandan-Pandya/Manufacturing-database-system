# DBMS Manufacturing & Production Management System - UI

A modern, responsive, and feature-rich Web Application UI designed precisely based on your Manufacturing & Production DBMS ER Diagram.

---

## 🏗️ ER Diagram Mapping

The application faithfully maps all **8 Entities**, their attributes, Primary Keys (PK), Foreign Keys (FK), and Relational Cardinalities:

| Entity Name | Primary Key | Attributes & Foreign Keys | Relationships |
| :--- | :--- | :--- | :--- |
| **Customers** | `cust_id` | `cust_name`, `phone_no`, `email`, `address` | Master records |
| **Suppliers** | `supp_id` | `company_name`, `phone`, `address` | Supplies `Raw_Material` (1:N) |
| **Raw Material** | `material_id` | `material_name`, `stock`, `unit_cost`, `supp_id` (FK) | Used in `Bill_of_Material` |
| **Work Center** | `centre_id` | `centre_name`, `hourly_rate`, `status`, `location` | Manufactures `Products` (1:N) |
| **Products** | `prod_id` | `prod_name`, `unit_price`, `stock`, `centre_id` (FK) | Scheduled for `Production_Orders` |
| **Bill of Material (BOM)** | `bom_id` | `prod_id` (FK), `material_id` (FK), `money` | Component cost breakdown recipe |
| **Production Orders** | `order_id` | `prod_id` (FK), `target`, `start_date`, `completion_date`, `status` | Tracked by `Production_Logs` (1:N) |
| **Production Logs** | `log_id` | `order_id` (FK), `labour_hours`, `units_completed`, `updated_at` | Shift entries & progress updates |

---

## 🚀 Clean Multi-Page Architecture (12 Dedicated Pages)

Instead of cramming multiple dense widgets on few screens, the operations suite is cleanly segmented into **12 dedicated, spacious pages**:

### 📊 Overview & Insights
1. **Operations Dashboard**: Clean executive summary with 4 KPI cards, live active production schedules, and quick launchpad.
2. **Operations Analytics**: Dedicated factory intelligence page with order fulfillment ratios, machine utilization %, productivity yield (pcs/hr), and top material capital assets.

### ⚙️ Production Management
3. **Products Catalog**: Dedicated product catalog with unit pricing, finished stock levels, work center assignment, and direct link to inspect BOM recipes.
4. **Bill of Materials (BOM) Explorer**: Dedicated interactive recipe hub with product selector card, component cost breakdown, gross profit margins, and master BOM specifications.
5. **Production Orders Schedule**: Clean scheduling table with status filter pills (`All`, `Pending`, `In Progress`, `Quality Check`, `Completed`), target units, and progress bars.
6. **Shopfloor Kanban Board**: Dedicated visual 4-stage workflow board (Pending &rarr; Assembly &rarr; Quality Inspection &rarr; Completed) with 1-click stage advancement.
7. **Shift Production Logs**: Dedicated shift tracker with hours logged, units completed, worker timestamps, and productivity yield metrics.

### 📦 Supply & Facilities
8. **Raw Materials Inventory**: Dedicated warehouse stock management with low-stock alerts, total valuation, and supplier links.
9. **Work Centers & Machinery**: Dedicated plant floor facilities with status badges, hourly machine rates, and locations.
10. **Suppliers Directory**: Dedicated vendor directory with contacts and relational materials supplied mapping.
11. **Customer Accounts**: Dedicated client directory with direct contact links and billing addresses.

### 🗺️ System Architecture
12. **Relational ER Diagram**: Dedicated visual diagram displaying all 8 entities, Primary Keys, Foreign Keys, and cardinalities.

---

## 💻 How to Run Locally

### 1. Database Configuration
1. Ensure PostgreSQL is installed and running.
2. Create a database (e.g. `Manufacturing System`) and execute the SQL schema from `database/schema.sql`.
3. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
4. Fill in your PostgreSQL database credentials in `.env`:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=Manufacturing System
   DB_USER=postgres
   DB_PASSWORD=your_password
   PORT=3000
   ```

### 2. Install Dependencies
```bash
pip install psycopg2-binary python-dotenv
```

### 3. Start the Server
Run the integrated Python backend server:
```bash
python server.py
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser. All CRUD operations and analytics will automatically sync live with your PostgreSQL database.
