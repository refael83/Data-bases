import psycopg2
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

SUPABASE_URL = os.getenv("DATABASE_URL")
LOCAL_URL = "postgresql://postgres:1234@localhost:5432/concordance"

def migrate():
    print("Connecting to Supabase...")
    src = psycopg2.connect(SUPABASE_URL, connect_timeout=30)
    src_cur = src.cursor()

    print("Connecting to local PostgreSQL...")
    dst = psycopg2.connect(LOCAL_URL)
    dst_cur = dst.cursor()

    # Get schema from Supabase (public schema tables only)
    src_cur.execute("""
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
    """)
    tables = [r[0] for r in src_cur.fetchall()]
    print(f"Found {len(tables)} tables: {tables}")

    # Get CREATE TABLE statements
    for table in tables:
        src_cur.execute(f"""
            SELECT column_name, data_type, character_maximum_length,
                   is_nullable, column_default, udt_name
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = '{table}'
            ORDER BY ordinal_position
        """)
        columns = src_cur.fetchall()

        col_defs = []
        for col_name, data_type, max_len, nullable, default, udt_name in columns:
            if default and 'nextval' in str(default):
                col_type = "SERIAL"
                col_def = f'"{col_name}" SERIAL'
            elif udt_name == 'int4':
                col_def = f'"{col_name}" INTEGER'
            elif udt_name == 'int8':
                col_def = f'"{col_name}" BIGINT'
            elif udt_name == 'bool':
                col_def = f'"{col_name}" BOOLEAN'
            elif udt_name == 'float8':
                col_def = f'"{col_name}" DOUBLE PRECISION'
            elif udt_name == 'text':
                col_def = f'"{col_name}" TEXT'
            elif udt_name == 'varchar' and max_len:
                col_def = f'"{col_name}" VARCHAR({max_len})'
            elif udt_name == 'timestamp' or udt_name == 'timestamptz':
                col_def = f'"{col_name}" TIMESTAMP'
            elif udt_name == 'date':
                col_def = f'"{col_name}" DATE'
            else:
                col_def = f'"{col_name}" {data_type.upper()}'

            if nullable == 'NO' and 'SERIAL' not in col_def:
                col_def += " NOT NULL"
            if default and 'nextval' not in str(default):
                col_def += f" DEFAULT {default}"

            col_defs.append(col_def)

        # Get primary key
        src_cur.execute(f"""
            SELECT kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_name = '{table}' AND tc.constraint_type = 'PRIMARY KEY'
        """)
        pk_cols = [r[0] for r in src_cur.fetchall()]

        create_sql = f'CREATE TABLE IF NOT EXISTS "{table}" (\n  '
        create_sql += ',\n  '.join(col_defs)
        if pk_cols:
            create_sql += f',\n  PRIMARY KEY ({", ".join(pk_cols)})'
        create_sql += "\n);"

        print(f"Creating table: {table}")
        dst_cur.execute(f'DROP TABLE IF EXISTS "{table}" CASCADE;')
        dst_cur.execute(create_sql)

    dst.commit()
    print("All tables created.")

    # Copy data table by table (order matters for foreign keys)
    # Simple approach: disable triggers, copy all, re-enable
    dst_cur.execute("SET session_replication_role = 'replica';")

    for table in tables:
        src_cur.execute(f'SELECT * FROM "{table}"')
        rows = src_cur.fetchall()
        if not rows:
            print(f"  {table}: 0 rows (skipped)")
            continue

        cols = [desc[0] for desc in src_cur.description]
        placeholders = ', '.join(['%s'] * len(cols))
        col_names = ', '.join([f'"{c}"' for c in cols])
        insert_sql = f'INSERT INTO "{table}" ({col_names}) VALUES ({placeholders})'

        for row in rows:
            dst_cur.execute(insert_sql, row)

        # Fix serial sequences
        src_cur.execute(f"""
            SELECT column_name, column_default FROM information_schema.columns
            WHERE table_name = '{table}' AND column_default LIKE 'nextval%%'
        """)
        for col_name, default in src_cur.fetchall():
            seq_name = default.split("'")[1] if "'" in default else None
            if seq_name:
                local_seq = f"{table}_{col_name}_seq"
                try:
                    dst_cur.execute(f'SELECT setval(\'"{local_seq}"\', (SELECT COALESCE(MAX("{col_name}"), 0) FROM "{table}") + 1);')
                except:
                    dst.rollback()
                    dst_cur.execute("SET session_replication_role = 'replica';")
                    try:
                        dst_cur.execute(f"SELECT setval('{local_seq}', (SELECT COALESCE(MAX(\"{col_name}\"), 0) FROM \"{table}\") + 1);")
                    except:
                        dst.rollback()
                        dst_cur.execute("SET session_replication_role = 'replica';")

        print(f"  {table}: {len(rows)} rows copied")

    dst_cur.execute("SET session_replication_role = 'origin';")
    dst.commit()

    src_cur.close()
    src.close()
    dst_cur.close()
    dst.close()
    print("\nMigration complete!")

if __name__ == "__main__":
    migrate()
