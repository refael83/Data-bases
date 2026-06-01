import os
import psycopg2
from dotenv import load_dotenv

# 1. Load the environment variables from the .env file
load_dotenv()

# 2. Fetch the connection string securely
DATABASE_URL = os.getenv("DATABASE_URL")

def test_database_connection():
    """Connects to the PostgreSQL database and prints the version."""
    conn = None
    try:
        print("Attempting to connect to the database...")
        
        # 3. Establish the connection
        conn = psycopg2.connect(DATABASE_URL)
        
        # 4. Create a cursor object to execute SQL commands
        cur = conn.cursor()
        
        # 5. Execute a simple test query
        cur.execute("SELECT version();")
        
        # 6. Fetch the result
        db_version = cur.fetchone()
        print(f"Success! Connected to: {db_version[0]}")
        
        # 7. Close the cursor
        cur.close()
        
    except (Exception, psycopg2.DatabaseError) as error:
        # If something goes wrong (wrong password, bad URL), it prints here
        print(f"Failed to connect. Error: {error}")
        
    finally:
        # 8. Always ensure the connection is closed, even if an error occurs
        if conn is not None:
            conn.close()
            print("Database connection closed.")

if __name__ == '__main__':
    test_database_connection()