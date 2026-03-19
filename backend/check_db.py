import asyncio
import asyncpg

async def main():
    try:
        conn = await asyncpg.connect(
            user='corpmeet',
            password='eW3lA7lU1j',
            database='corpmeet',
            host='194.87.138.47',
            port=5432
        )
        print("Connected successfully!")
        
        # Get all tables in public schema
        tables = await conn.fetch('''
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ''')
        
        if not tables:
            print("No tables found in public schema.")
        else:
            print(f"Found {len(tables)} tables.")
            for table in tables:
                table_name = table['table_name']
                print(f"\n=== Table: {table_name} ===")
                
                # Get column info
                columns = await conn.fetch('''
                    SELECT column_name, data_type, is_nullable 
                    FROM information_schema.columns 
                    WHERE table_schema = 'public' AND table_name = $1
                    ORDER BY ordinal_position
                ''', table_name)
                print("Columns:")
                for col in columns:
                    print(f"  - {col['column_name']} ({col['data_type']}, nullable: {col['is_nullable']})")
                
                # Get row count
                count = await conn.fetchval(f'SELECT count(*) FROM "{table_name}"')
                print(f"Total rows: {count}")
                
                # Fetch first 3 rows
                if count > 0:
                    rows = await conn.fetch(f'SELECT * FROM "{table_name}" LIMIT 3')
                    print("Sample data (max 3 rows):")
                    for row in rows:
                        print(f"  {dict(row)}")

        await conn.close()
    except Exception as e:
        print(f"Error connecting: {e}")

asyncio.run(main())
