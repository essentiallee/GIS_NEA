"""A small read-only query tool for the local DuckDB database.

Example: python processing/query.py --sql "SELECT * FROM accounting"
Use --file processing/sql/research_questions.sql for the supplied query examples.
"""
import argparse
from pathlib import Path
import duckdb

def query(database, sql):
    # Read-only mode protects the saved analysis tables from accidental changes.
    with duckdb.connect(str(database), read_only=True,
                        config={'extension_directory':str(Path(database).parent/'extensions')}) as connection:
        connection.execute('LOAD spatial')
        return connection.sql(sql).df()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database', type=Path, default=Path(__file__).parent/'build/analysis.duckdb')
    choice = parser.add_mutually_exclusive_group(required=True)
    choice.add_argument('--sql')
    choice.add_argument('--file', type=Path)
    parser.add_argument('--csv', type=Path, help='Optional output CSV')
    args = parser.parse_args()
    result = query(args.database, args.file.read_text() if args.file else args.sql)
    print(result.to_string(index=False))
    if args.csv:
        result.to_csv(args.csv,index=False)
