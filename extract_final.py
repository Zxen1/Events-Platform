import re
import json
import sys

sql_path = r'D:\Websites\Events Platform Cursor 2025\Events-Platform\funmapco_db - 2026-01-26T205936.887.sql'

locations = []
with open(sql_path, 'rb') as f:
    for line_bytes in f:
        try:
            line = line_bytes.decode('utf-8')
        except UnicodeDecodeError:
            line = line_bytes.decode('latin-1')
            
        line = line.strip()
        if line.startswith('(') and (line.endswith('),') or line.endswith(');')):
            row = line[1:-2]
            row_parts = []
            current = []
            in_quotes = False
            escaped = False
            for char in row:
                if char == "\\" and not escaped:
                    escaped = True
                    current.append(char)
                    continue
                if char == "'" and not escaped:
                    in_quotes = not in_quotes
                if char == ',' and not in_quotes:
                    row_parts.append(''.join(current).strip().strip("'"))
                    current = []
                else:
                    current.append(char)
                escaped = False
            row_parts.append(''.join(current).strip().strip("'"))
            
            if len(row_parts) == 31:
                try:
                    locations.append({
                        'name': row_parts[15],
                        'lat': float(row_parts[18]),
                        'lng': float(row_parts[19]),
                        'type': row_parts[14]
                    })
                except (ValueError, IndexError):
                    continue

with open('full_locations.json', 'w', encoding='utf-8') as f:
    json.dump(locations, f)

print(f"Extracted {len(locations)} locations to full_locations.json")
