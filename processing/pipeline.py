import argparse
import colorsys
import csv
import hashlib
import json
import math
import shutil
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import duckdb
import geopandas as gpd
import pandas as pd
import pyproj

# Use installed projection definitions consistently, including offline/local runs.
# An unavailable remote grid must not turn projected coordinates into infinity.
pyproj.network.set_network_enabled(False)

ROOT = Path(__file__).resolve().parents[1]
SQL = Path(__file__).parent / 'sql'
FEET_PER_METER = 3937 / 1200  # EPSG:2263 uses US survey feet.
VENUE_COLORS = {
    'Theater':'#db567f', 'Music':'#6b967e', 'Dance':'#d7b845', 'Visual Arts':'#a998b6',
    'Multi-Discipl, Perf & Non-Perf':'#d39165', 'Multi-Discipline, Performing':'#a77886',
    'Multi-Discipline, Non-Perform':'#9d9858', 'Film/Video/Audio':'#728fa4',
    'Museum':'#c58059', 'Literature':'#8e77a2', 'Other':'#96958a', 'Folk Arts':'#8ea764',
    'Architecture/Design':'#789b99', 'Humanities':'#bd8a99', 'New Media':'#8e93b6',
    'Science':'#638389', 'Photography':'#787c95', 'Botanical':'#5f8f68',
    'Crafts':'#b3a569', 'Zoo':'#8f8f59', 'Not recorded':'#b9bcb4'
}

def check(condition, message):
    if not condition:
        raise ValueError(message)

def write_json(path, value):
    path.write_text(json.dumps(value, separators=(',', ':'), allow_nan=False))

def features(items):
    return {'type': 'FeatureCollection', 'features': items}

def feature(geometry, properties):
    return {'type': 'Feature', 'geometry': geometry, 'properties': properties}

def point(record):
    properties = {k:v for k,v in record.items() if k!='coordinates'}
    return feature({'type':'Point','coordinates':record['coordinates']}, properties)

def load_config(path):
    config = json.loads(path.read_text())
    for key in ['source_dir','tracts','directory_csv']:
        config[key] = (path.parent / Path(config[key]).expanduser()).resolve()
    return config

def read_geocoder(path):
    # Census batch output has no header; unsuccessful rows may have fewer fields.
    rows = []
    with path.open() as file:
        for row in csv.reader(file):
            row += [''] * max(0,8-len(row))
            rows.append({'id':row[0], 'status':row[2],
                         'matched_address':row[4], 'coordinate_text':row[5]})
    return pd.DataFrame(rows)

def make_palette(codes):
    result = {}
    for i, code in enumerate(sorted(codes)):
        rgb = colorsys.hls_to_rgb((i*.61803398875)%1,.59,.34)
        result[code] = '#'+''.join(f'{round(v*255):02x}' for v in rgb)
    return result

def lighter(hex_color, fraction):
    channels = [int(hex_color[i:i+2],16) for i in [1,3,5]]
    return '#'+''.join(f'{round(v+(255-v)*fraction):02x}' for v in channels)

def geometry_lookup(connection, query):
    return {row[0]:json.loads(row[1]) for row in connection.execute(query).fetchall()}

def wgs84(expression):
    return f"ST_AsGeoJSON(ST_Transform({expression},'EPSG:2263','EPSG:4326',always_xy:=true))"

def export_web(connection, staging, palette, chapters_path):
    rows = connection.sql('''SELECT id,name,nta,longitude,latitude,cents2024,cents2025
                            FROM recipients WHERE cents2024<>0 OR cents2025<>0 ORDER BY id''').fetchall()
    recipients = []
    for uid,name,nta,lon,lat,a,b in rows:
        recipients.append({'id':uid,'name':name,'nta':nta,
            'coordinates':[lon,lat] if lon is not None else None,
            'fy2024':a/100,'fy2025':b/100,'change':(b-a)/100,
            'color':palette.get(nta,'#b7b7b0'),'kind':'recipient'})
    recipient_by_id = {r['id']:r for r in recipients}
    nta_points = geometry_lookup(connection, f'SELECT id,{wgs84("ST_PointOnSurface(geom)")} FROM nta_funding')
    neighborhoods = []
    for uid,name,a,b,count in connection.sql('''SELECT id,name,cents2024,cents2025,recipient_count
                                  FROM nta_funding WHERE cents2024<>0 OR cents2025<>0 ORDER BY id''').fetchall():
        neighborhoods.append({'id':uid,'name':name,'coordinates':nta_points[uid]['coordinates'],
            'fy2024':a/100,'fy2025':b/100,'change':(b-a)/100,
            'recipient_count':count,'color':palette.get(uid,'#b7b7b0'),'kind':'neighborhood'})

    counts = dict(connection.sql('SELECT id,nearby_records FROM nearby_counts').fetchall())
    anchors = []
    colors = ['#db567f','#e6c95f','#6b967e','#a998b6','#dfa473']
    for i,(uid,) in enumerate(connection.sql('SELECT id FROM anchors ORDER BY change_cents,name,id').fetchall()):
        anchors.append({**recipient_by_id[uid], 'nearby_records':counts[uid],
                        'color':colors[i%len(colors)],'kind':'anchor'})
    anchors_by_id = {a['id']:a for a in anchors}
    accounting = connection.sql('SELECT * FROM accounting ORDER BY fiscal_year').fetchall()
    stats = {'fy2024':accounting[0][1]/100,'fy2025':accounting[1][1]/100,
        'unlocated2024':accounting[0][3]/100,'unlocated2025':accounting[1][3]/100,
        'positive2024':connection.sql('SELECT count(*) FROM recipients WHERE cents2024>0').fetchone()[0],
        'positive2025':connection.sql('SELECT count(*) FROM recipients WHERE cents2025>0').fetchone()[0],
        'declines':connection.sql('SELECT count(*) FROM recipients WHERE change_cents<0').fetchone()[0]}
    stats['directory_records'] = connection.sql('SELECT count(*) FROM directory').fetchone()[0]
    for year in [2024,2025]:
        stats[f'mapped_positive{year}'] = connection.sql(
            f'SELECT count(*) FROM recipient_points WHERE cents{year}>0').fetchone()[0]
    nta_legend = [{'id':n['id'],'name':n['name'],'color':n['color']} for n in neighborhoods]
    venue_types = [{'type':category,'count':count,'color':VENUE_COLORS.get(category,'#b9bcb4')}
                   for category,count in connection.sql('''
                       SELECT COALESCE(discipline,'Not recorded') AS category,count(*) AS records
                       FROM directory GROUP BY category ORDER BY records DESC,category''').fetchall()]
    write_json(staging/'funding.json',dict(recipients=recipients,neighborhoods=neighborhoods,
                                         anchors=anchors,stats=stats,palette=palette,
                                         ntaLegend=nta_legend,venueTypes=venue_types))

    nta_geometries = geometry_lookup(connection, f'SELECT id,{wgs84("ST_SimplifyPreserveTopology(geom,35)")} FROM ntas')
    active_nta_ids = {n['id'] for n in neighborhoods}
    ntas = features([feature(nta_geometries[uid],{'nta2020':uid,'ntaname':name,'boroname':borough,
                                                'color':palette.get(uid,'#deded7'),
                                                'has_funding_records':uid in active_nta_ids})
                    for uid,name,borough in connection.sql('SELECT id,name,borough FROM ntas ORDER BY id').fetchall()])
    directory = features([feature({'type':'Point','coordinates':[lon,lat]},
                         {'record_id':uid,'name':name,'discipline':discipline,
                          'type_color':VENUE_COLORS.get(discipline or 'Not recorded','#b9bcb4')})
                         for uid,name,discipline,lon,lat in connection.sql(
                             'SELECT record_id,name,discipline,longitude,latitude FROM directory ORDER BY record_id').fetchall()])
    write_json(staging/'story-ntas.geojson',ntas)
    write_json(staging/'nyc-ntas.geojson',ntas)
    write_json(staging/'dcla-organizations.geojson',directory)

    # Footprints and geographic transformations are prepared here, not in JavaScript.
    half_width = 80 * FEET_PER_METER
    box = f'ST_MakeEnvelope(ST_X(geom)-{half_width},ST_Y(geom)-{half_width},ST_X(geom)+{half_width},ST_Y(geom)+{half_width})'
    columns = geometry_lookup(connection, f'SELECT id,{wgs84(box)} FROM recipient_points')
    funding_columns = []
    for r in recipients:
        if r['coordinates'] is None:
            continue
        props = {k:v for k,v in r.items() if k!='coordinates'}
        props.update(h24=max(0,r['fy2024'])*.045,h25=max(0,r['fy2025'])*.045)
        funding_columns.append(feature(columns[r['id']],props))

    paired = []
    for year, offset in [(2024,-.6),(2025,.6)]:
        half_width = 130 * FEET_PER_METER
        shift = offset * 260 * FEET_PER_METER
        x,y = 'ST_X(ST_PointOnSurface(geom))','ST_Y(ST_PointOnSurface(geom))'
        box = f'ST_MakeEnvelope({x}+{shift}-{half_width},{y}-{half_width},{x}+{shift}+{half_width},{y}+{half_width})'
        polygons = geometry_lookup(connection, f'SELECT id,{wgs84(box)} FROM nta_funding')
        for n in neighborhoods:
            props = {k:v for k,v in n.items() if k!='coordinates'}
            props.update(year=year,height=max(0,n[f'fy{year}'])*.008,
                         color=lighter(n['color'],.56) if year==2024 else n['color'])
            paired.append(feature(polygons[n['id']],props))
    buffer_geometries = geometry_lookup(connection, f'SELECT id,{wgs84("geom")} FROM buffers')
    links = []
    for a,b,distance,geometry in connection.sql(f'SELECT from_id,to_id,distance_feet,{wgs84("geom")} FROM proposal_links ORDER BY from_id,to_id').fetchall():
        links.append(feature(json.loads(geometry),{'from_id':a,'to_id':b,
            'name':anchors_by_id[a]['name']+' / '+anchors_by_id[b]['name'],
            'distance_feet':distance,'kind':'proposal'}))
    map_sources = {
        'recipients':features([point(r) for r in recipients if r['coordinates']]),
        'funding-columns':features(funding_columns),'nta-columns':features(paired),
        'negative-ntas':features([point(n) for n in neighborhoods if min(n['fy2024'],n['fy2025'])<0]),
        'anchors':features([point(a) for a in anchors]),
        'buffers':features([feature(buffer_geometries[a['id']],{**a,'kind':'buffer'}) for a in anchors]),
        'proposal':features(links)
    }
    write_json(staging/'map-sources.json',map_sources)
    chapters = json.loads(chapters_path.read_text())
    check(len(chapters)==8,'The source chapter file must contain eight chapters.')
    decline = (1-stats['fy2025']/stats['fy2024'])*100
    chapters[1]['metric'] = f"{stats['positive2024']:,} recipients"
    chapters[1]['caption'] = f"${stats['fy2024']/1e6:.2f}M recorded in FY2024"
    chapters[2]['metric'] = f'−{decline:.1f}%'
    chapters[2]['caption'] = f"${stats['fy2024']/1e6:.2f}M → ${stats['fy2025']/1e6:.2f}M · approximately ${(stats['fy2024']-stats['fy2025'])/1e6:.2f}M less"
    chapters[4]['metric'] = f'{len(neighborhoods)} mapped NTAs'
    chapters[5]['method'] = ('Count directory records within a projected half-mile (2,640 US survey feet) of these 12 examples. '
                             'Co-located and duplicate directory records remain included. Poverty and visitor-origin comparisons are still pending.')
    write_json(staging/'chapters.json',chapters)
    return stats

def run_pipeline(config, project_root=ROOT, output_dir=None):
    root = Path(project_root)
    destination = Path(output_dir) if output_dir else root/'data'
    build = root/'processing/build'
    build.mkdir(parents=True,exist_ok=True)
    source_dir = Path(config['source_dir'])
    inputs = {name:source_dir/name for name in ['eligible_transactions.csv','organization_locations.csv',
        'census_geocoder_response.csv','observed_organization_year_cents.csv']}
    inputs.update(tracts=Path(config['tracts']),directory=Path(config['directory_csv']))
    for suffix in ['.dbf','.shx','.prj','.cpg']:
        sidecar = inputs['tracts'].with_suffix(suffix)
        if sidecar.is_file():
            inputs['tracts'+suffix] = sidecar
    for name,path in inputs.items():
        check(path.is_file(),f'Missing input {name}: {path}')
    with tempfile.TemporaryDirectory(dir=build) as temporary:
        temporary = Path(temporary)
        database = temporary/'analysis.duckdb'
        connection = duckdb.connect(str(database),config={'extension_directory':str(build/'extensions')})
        try:
            try:
                connection.execute('LOAD spatial')
            except duckdb.Error:
                connection.execute('INSTALL spatial')
                connection.execute('LOAD spatial')
            # Import only the tables needed for this analysis.
            connection.read_csv(str(inputs['eligible_transactions.csv']),all_varchar=True).create_view('input_transactions')
            connection.read_csv(str(inputs['organization_locations.csv']),all_varchar=True).create_view('input_locations')
            geocoder = read_geocoder(inputs['census_geocoder_response.csv'])
            connection.register('input_geocoder',geocoder)
            connection.execute((SQL/'01_funding.sql').read_text())
            check(connection.sql('SELECT count(*) FROM transactions WHERE cents<>checked_cents OR checked_cents IS NULL').fetchone()[0]==0,
                  'Dollar amounts do not match the existing integer-cent amounts.')
            check(connection.sql('SELECT count(*)-count(DISTINCT transaction_id) FROM transactions').fetchone()[0]==0,
                  'Duplicate transaction IDs: inspect rather than silently deleting rows.')
            check(connection.sql('SELECT count(*)-count(DISTINCT id) FROM recipient_locations').fetchone()[0]==0,'Duplicate location IDs.')
            check(connection.sql('SELECT count(*)-count(DISTINCT id) FROM geocoder').fetchone()[0]==0,'Duplicate Census response IDs.')
            check(connection.sql('SELECT count(*) FROM recipients WHERE name IS NULL').fetchone()[0]==0,'A recipient has no location accounting record.')
            check(connection.sql('''SELECT count(*) FROM transactions WHERE fiscal_year <>
                year(action_date)+CASE WHEN month(action_date)>=10 THEN 1 ELSE 0 END''').fetchone()[0]==0,
                'Fiscal-year labels disagree with transaction action dates.')
            # Confirm that aggregation reproduces the earlier accepted series exactly.
            old = pd.read_csv(inputs['observed_organization_year_cents.csv'],dtype={'recipient_uei':str})
            connection.register('old_series',old)
            differences = connection.sql('''SELECT count(*) FROM annual_funding a FULL JOIN old_series o
                ON a.id=o.recipient_uei WHERE a.id IS NULL OR o.recipient_uei IS NULL
                OR a.cents2024<>o."2024" OR a.cents2025<>o."2025"''').fetchone()[0]
            check(differences==0,'The rebuilt annual series differs from the accepted series; inspect before publishing.')
            print('Funding sums reproduced from transaction rows.')

            tracts = gpd.read_file(inputs['tracts']).to_crs(2263)
            check(all(math.isfinite(value) for row in tracts.geometry.bounds.itertuples(index=False,name=None)
                      for value in row),'Projection produced non-finite coordinates; inspect CRS definitions.')
            invalid_geometries = int((~tracts.geometry.is_valid).sum())
            if invalid_geometries:
                tracts.geometry = tracts.geometry.make_valid()
            ntas = tracts[['nta2020','ntaname','boroname','geometry']].dissolve(by='nta2020',aggfunc='first').reset_index()
            nta_input = pd.DataFrame(ntas.drop(columns='geometry'))
            nta_input['wkb'] = ntas.geometry.to_wkb()
            connection.register('input_ntas',nta_input)
            connection.read_csv(str(inputs['directory']),all_varchar=True).create_view('input_directory')
            connection.execute((SQL/'02_spatial.sql').read_text())
            check(connection.sql('SELECT count(*) FROM accounting WHERE total_cents<>located_cents+unlocated_cents').fetchone()[0]==0,
                  'Located and unlocated funds do not reconcile.')
            check(connection.sql("SELECT count(*) FROM recipients WHERE nta<>'UNMAPPED' AND nta NOT IN (SELECT id FROM ntas)").fetchone()[0]==0,
                  'A recorded NTA code is absent from the boundary data.')
            for year in [2024,2025]:
                expected = connection.sql(f"SELECT sum(cents{year}) FROM recipients WHERE nta<>'UNMAPPED'").fetchone()[0]
                actual = connection.sql(f'SELECT sum(cents{year}) FROM nta_funding').fetchone()[0]
                check(expected==actual,f'NTA sums do not reconcile for FY{year}.')
            check(connection.sql('SELECT count(*) FROM nearby_counts').fetchone()[0]==connection.sql('SELECT count(*) FROM anchors').fetchone()[0],
                  'An anchor is missing a nearby-record count.')
            palette = make_palette({row[0] for row in connection.sql("SELECT DISTINCT nta FROM recipient_locations WHERE nta<>'UNMAPPED'").fetchall()})
            web = temporary/'web'
            web.mkdir()
            stats = export_web(connection,web,palette,root/'content/chapters.json')
            counts = {table:connection.sql(f'SELECT count(*) FROM {table}').fetchone()[0]
                      for table in ['transactions','recipients','ntas','directory_all','directory','anchors','proposal_links']}
            audit = dict(connection.sql('SELECT result,count(*) FROM nta_assignment_audit GROUP BY result').fetchall())
            manifest = {'created_utc':datetime.now(timezone.utc).isoformat(),'duckdb_version':duckdb.__version__,
                'counts':counts,'funding':stats,'nta_assignment_audit':audit,
                'invalid_tract_geometries_repaired':invalid_geometries,
                'distance_method':'EPSG:2263, US survey feet; radius 2640 feet',
                'nta_rule':'Historical recorded assignment retained; full-geometry spatial join exported as audit.',
                'input_sha256':{name:hashlib.sha256(path.read_bytes()).hexdigest() for name,path in inputs.items()}}
            write_json(web/'processing-manifest.json',manifest)
            reports = temporary/'reports'
            reports.mkdir()
            for table in ['accounting','nta_assignment_audit','nearby_counts']:
                connection.sql(f'SELECT * FROM {table}').df().to_csv(reports/f'{table}.csv',index=False)
            connection.sql('SELECT * FROM annual_funding').write_parquet(str(reports/'annual_funding.parquet'))
            connection.sql('SELECT id,name,geocode_status,nta,cents2024,cents2025 FROM recipients WHERE longitude IS NULL').df().to_csv(reports/'unlocated_recipients.csv',index=False)
            connection.sql('SELECT id,name,cents2024,cents2025,recipient_count FROM nta_funding ORDER BY id').df().to_csv(reports/'nta_funding.csv',index=False)
            connection.sql('SELECT id,name,cents2024,cents2025,recipient_count FROM nta_funding ORDER BY id').write_parquet(str(reports/'nta_funding.parquet'))
            write_json(reports/'processing-manifest.json',manifest)
            print(json.dumps(manifest,indent=2))
            # Remove input views: the resulting query database is self-contained.
            for name in ['input_transactions','input_locations','input_geocoder','input_ntas','input_directory','old_series']:
                connection.execute(f'DROP VIEW IF EXISTS {name}')
            connection.execute('CHECKPOINT')
        finally:
            connection.close()
        destination.mkdir(parents=True,exist_ok=True)
        for path in web.iterdir():
            shutil.copy2(path,destination/path.name)
        final_reports = build/'reports'
        final_reports.mkdir(exist_ok=True)
        for path in reports.iterdir():
            shutil.copy2(path,final_reports/path.name)
        database.replace(build/'analysis.duckdb')
    return manifest

if __name__=='__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config',type=Path,default=Path(__file__).parent/'config.local.json')
    parser.add_argument('--output-dir',type=Path,help='Optional alternative web export folder')
    args = parser.parse_args()
    run_pipeline(load_config(args.config.resolve()),output_dir=args.output_dir)
