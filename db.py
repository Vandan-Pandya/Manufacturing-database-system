import os
import re
import datetime
from decimal import Decimal
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "Manufacturing db system")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")

ENTITY_TABLE_MAP = {
    "customers": "customers",
    "suppliers": "suppliers",
    "raw_materials": ["raw_materials", "raw_material"],
    "work_centers": ["work_centers", "work_center", "work_centre", "work_centres"],
    "products": "products",
    "bill_of_materials": ["bill_of_materials", "bill_of_material"],
    "production_orders": "production_orders",
    "production_logs": "production_logs"
}

PRIMARY_KEYS = {
    "customers": "cust_id",
    "suppliers": "supp_id",
    "raw_materials": "material_id",
    "raw_material": "material_id",
    "work_centers": "centre_id",
    "work_center": "centre_id",
    "work_centre": "centre_id",
    "work_centres": "centre_id",
    "products": "prod_id",
    "bill_of_materials": "bom_id",
    "bill_of_material": "bom_id",
    "production_orders": "order_id",
    "production_logs": "log_id"
}

def get_connection():
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        connect_timeout=3
    )

def serialize_val(val):
    if isinstance(val, (datetime.date, datetime.datetime)):
        return val.isoformat()
    elif isinstance(val, Decimal):
        return float(val)
    return val

def test_connection():
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public';
                """)
                tables = [row[0] for row in cur.fetchall()]
                return {
                    "connected": True,
                    "database": DB_NAME,
                    "tables": tables,
                    "error": None
                }
    except Exception as e:
        return {
            "connected": False,
            "database": DB_NAME,
            "tables": [],
            "error": str(e)
        }

def find_actual_table_name(conn, candidate_names):
    if isinstance(candidate_names, str):
        candidate_names = [candidate_names]
    with conn.cursor() as cur:
        for name in candidate_names:
            cur.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND LOWER(table_name) = LOWER(%s);
            """, (name,))
            row = cur.fetchone()
            if row:
                return row[0]
    return candidate_names[0]

def get_all_data():
    data = {}
    with get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            for entity_key, candidates in ENTITY_TABLE_MAP.items():
                table_name = find_actual_table_name(conn, candidates)
                try:
                    cur.execute(f'SELECT * FROM "{table_name}";')
                    rows = cur.fetchall()
                    serialized_rows = [
                        {k.lower(): serialize_val(v) for k, v in dict(row).items()}
                        for row in rows
                    ]
                    data[entity_key] = serialized_rows
                except Exception as e:
                    print(f"Error fetching table {table_name}: {e}")
                    conn.rollback()
                    data[entity_key] = []
    return data

def get_entity_data(entity_key):
    if entity_key not in ENTITY_TABLE_MAP:
        raise ValueError(f"Unknown entity key: {entity_key}")
    with get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            table_name = find_actual_table_name(conn, ENTITY_TABLE_MAP[entity_key])
            cur.execute(f'SELECT * FROM "{table_name}";')
            rows = cur.fetchall()
            return [
                {k.lower(): serialize_val(v) for k, v in dict(row).items()}
                for row in rows
            ]

def coerce_record(conn, table_name, record):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND LOWER(table_name) = LOWER(%s);
        """, (table_name,))
        col_types = {row[0].lower(): row[1].lower() for row in cur.fetchall()}
        
        coerced = {}
        for k, v in record.items():
            k_lower = k.lower()
            if k_lower not in col_types:
                continue
            dt = col_types[k_lower]
            if v is None or (isinstance(v, str) and not v.strip()):
                coerced[k_lower] = None
                continue
            if 'int' in dt:
                digits = re.sub(r'[^\d]', '', str(v))
                if digits:
                    coerced[k_lower] = int(digits)
                else:
                    cur.execute(f'SELECT COALESCE(MAX("{k_lower}"), 0) + 1 FROM "{table_name}";')
                    coerced[k_lower] = cur.fetchone()[0]
            elif 'numeric' in dt or 'decimal' in dt or 'double' in dt or 'real' in dt:
                try:
                    coerced[k_lower] = float(v)
                except (ValueError, TypeError):
                    coerced[k_lower] = 0.0
            else:
                coerced[k_lower] = str(v)
        return coerced

def create_record(entity_key, record):
    if entity_key not in ENTITY_TABLE_MAP:
        raise ValueError(f"Unknown entity: {entity_key}")
    with get_connection() as conn:
        table_name = find_actual_table_name(conn, ENTITY_TABLE_MAP[entity_key])
        coerced = coerce_record(conn, table_name, record)
        keys = list(coerced.keys())
        values = [coerced[k] for k in keys]
        cols_str = ', '.join([f'"{k}"' for k in keys])
        placeholders = ', '.join(['%s'] * len(keys))
        query = f'INSERT INTO "{table_name}" ({cols_str}) VALUES ({placeholders}) RETURNING *;'
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, values)
            conn.commit()
            row = cur.fetchone()
            return {k.lower(): serialize_val(v) for k, v in dict(row).items()}

def update_record(entity_key, id_val, record):
    if entity_key not in ENTITY_TABLE_MAP:
        raise ValueError(f"Unknown entity: {entity_key}")
    with get_connection() as conn:
        table_name = find_actual_table_name(conn, ENTITY_TABLE_MAP[entity_key])
        pk_col = PRIMARY_KEYS.get(table_name.lower()) or PRIMARY_KEYS.get(entity_key)
        coerced = coerce_record(conn, table_name, record)
        keys = [k for k in coerced.keys() if k.lower() != pk_col.lower()]
        set_clauses = ', '.join([f'"{k}" = %s' for k in keys])
        values = [coerced[k] for k in keys] + [id_val]
        query = f'UPDATE "{table_name}" SET {set_clauses} WHERE "{pk_col}" = %s RETURNING *;'
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, values)
            conn.commit()
            row = cur.fetchone()
            if row:
                return {k.lower(): serialize_val(v) for k, v in dict(row).items()}
            return None

def delete_record(entity_key, id_val):
    if entity_key not in ENTITY_TABLE_MAP:
        raise ValueError(f"Unknown entity: {entity_key}")
    with get_connection() as conn:
        table_name = find_actual_table_name(conn, ENTITY_TABLE_MAP[entity_key])
        pk_col = PRIMARY_KEYS.get(table_name.lower()) or PRIMARY_KEYS.get(entity_key)
        query = f'DELETE FROM "{table_name}" WHERE "{pk_col}" = %s;'
        with conn.cursor() as cur:
            cur.execute(query, (id_val,))
            conn.commit()
            return cur.rowcount > 0

