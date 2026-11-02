#!/usr/bin/env python3
"""Generate shared/walzcraftDistributorMatches.ts + client/public/walzcraft/doors/*.webp
from the active /workspace/walz/*_vs_WalzCraft.csv matching sheets (not _shelved_pre_walzcraft CSVs).
Only CSV values are emitted; per-color % is not in the sources (null + estimated)."""
import csv, json, os, re
from PIL import Image
W='/workspace/walz'; ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'client/public/walzcraft/doors'); os.makedirs(OUT,exist_ok=True)
DRAW_DIRS=[f'{W}/_shelved_pre_walzcraft/{d}/dr' for d in ('MS','US','CW')]
DIST={'Faircrest':('faircrest_codes','faircrest_geometry'),'KitchenCrest':('kitchencrest_colors','kitchencrest_geometry'),
      'DLCabinetry':('dl_codes','dl_geometry'),'AltaEuro':('altaeuro_codes','altaeuro_geometry')}
LABEL={'Faircrest':'Faircrest','KitchenCrest':'Kitchen Crest','DLCabinetry':'DL Cabinetry','AltaEuro':'AltaEuro'}
# Door names: from distributor page/catalog files in /workspace/walz (FC/*.html, KC catalog, DL/home.html, AE file names).
NAMES={'Faircrest':{'WS':'White Shaker','PS':'Platinum Shaker','MBS':'Midnight Black Shaker','FS':'Fresh Sage','CC':'Classic Cream',
  'HS':'Hickory Shaker','RH':'Rustic Hickory','DN':'Designer Natural','WPG':'West Point Grey','NG':'Winchester Grey','CS':'Carmel Shaker',
  'GV':'Greek Villa','ASP':'Aspen White'},
 'KitchenCrest':{'SW':'Shaker White','LG':'Light Grey','SN':'Shaker Navy','MW':'Modern Wood','EW':'Estate White','EB':'Estate Black','ES':'Estate Sage'},
 'DLCabinetry':{'WS':'White Shaker','DG':'Dove Grey','CG':'Cyber Grey','MC':'Midnight Cove','SSA':'Slim Shaker Alabaster','SSE':'Slim Shaker Ebony',
  'PW':'Pearl White','GW':'Glacier White'},
 'AltaEuro':{'ZSW':'Zenit Blanco','ZSI':'Zenit Azul Indigo','PGW':'Palermo Gloss White','LSA':'Luxe Agua Marina','LSC':'Luxe Cashmere',
  'TGW':'Torino Grey Wood','TDW':'Torino Dark Wood','SSN':'Syncron Nocce 01','LSP':'Luxe Picasso 01','ZCK':'Slim Cava Black','ZCC':'Slim Cava Cashmere',
  'SCR':'Syncron Slim Cava Rosales 1'}}
KC_CODE={'Shaker White':'SW','Light Grey':'LG','Shaker Navy':'SN','Modern Wood':'MW','Estate White':'EW','Estate Black':'EB','Estate Sage':'ES'}
AE_GROUP={'G1':['ZSW','ZSI','PGW','LSA','LSC'],'G2':['TGW','TDW','SSN','LSP'],'G3':['ZCK','ZCC','SCR']}
AE_FILE={'ZSW':'Zenit_Blanco_ZSW.png','ZSI':'Zenit_Azul_Indigo_ZSI.png','PGW':'u_PGW.jpg','LSA':'Luxe_Agua_Marina_LSA.png','LSC':'Luxe_Cashmere_LSC.png',
 'TGW':'TGW_Door.jpg','TDW':'TDW_Door.jpg','SSN':'Syncron_Nocce_01_SSN_V.png','LSP':'Luxe_Picasso_01_LSP_V.png','ZCK':'Slim_Cava_Black_ZCK.png',
 'ZCC':'Slim_Cava_Cashmere_ZCC.png','SCR':'Syncron_Slim_Cava_Rosales_1_SCR_V.png'}
DIRS={'Faircrest':'FC','KitchenCrest':'KC','DLCabinetry':'DL','AltaEuro':'AE'}
TEMPLATE_BY_NAME={'Barrington':'S592'}  # only CSV match that exists in WALZCRAFT_PROFILE_TEMPLATES
def slug(s): return re.sub(r'[^a-z0-9]+','-',s.lower()).strip('-')
def webp(src,name):
    im=Image.open(src).convert('RGB')
    if im.height>600: im=im.resize((round(im.width*600/im.height),600),Image.LANCZOS)
    im.save(os.path.join(OUT,name),'WEBP',quality=80); return '/walzcraft/doors/'+name
def photo(dist,code):
    d=f'{W}/{DIRS[dist]}'
    if dist=='AltaEuro': p=f'{d}/{AE_FILE[code]}'
    elif dist=='Faircrest' and code=='RH': p='/workspace/fr/faircrest/RH-Full-Door.jpeg'
    else: p=f'{d}/t_{code}.jpg'
    return webp(p,f'{slug(LABEL[dist])}-{code.lower()}.webp') if os.path.exists(p) else None
def drawing(sr):
    m=re.match(r'(SR\d+)',sr or '')
    if not m: return None
    for dd in DRAW_DIRS:
        p=f'{dd}/{m.group(1)}.png'
        if os.path.exists(p): return webp(p,f'profile-{m.group(1).lower()}.webp')
    return None
def color_for(dist,code,name,fin):
    for part in fin.split(';'):
        if '→' not in part: continue
        k,v=[x.strip() for x in part.split('→',1)]
        keys=[x.strip() for x in k.split('/')]
        if code in keys or (dist=='AltaEuro' and any(x and x.lower() in name.lower() for x in keys)):
            return v
    return None
doors=[]
for dist,(ccol,gcol) in DIST.items():
    rows=list(csv.DictReader(open(f'{W}/{dist}_vs_WalzCraft.csv',encoding='utf-8')))
    groups={}
    for r in rows: groups.setdefault(r['group'],[]).append(r)
    for g,rs in groups.items():
        r0=rs[0]
        if dist=='AltaEuro': codes=AE_GROUP[g.split()[0]]
        elif dist=='KitchenCrest': codes=[KC_CODE[x.strip()] for x in r0[ccol].split(',')]
        else: codes=r0[ccol].split()
        matches=[{'rank':int(r['rank']),'walzcraft':r['walzcraft_match'],'confidencePct':int(r['confidence'].rstrip('%')),
                  'profileCode':r['walzcraft_profile'] or None,'drawing':drawing(r['walzcraft_profile']),
                  'templateId':TEMPLATE_BY_NAME.get(r['walzcraft_match'])} for r in rs]
        for code in codes:
            name=NAMES[dist].get(code)
            col=color_for(dist,code,name or '',r0['closest_finish'])
            doors.append({'id':f'{slug(LABEL[dist])}-{code.lower()}','distributor':LABEL[dist],'code':code,'doorName':name,
              'group':g,'geometry':r0[gcol],'walzcraftColor':col,'colorMatchPct':None,'colorEstimated':True,
              'colorSourceText':r0['closest_finish'],'unknowns':[u.strip() for u in r0['unknowns'].split(';') if u.strip()],
              'photo':photo(dist,code),'sheet':r0['page'],'matches':matches})
ts='// GENERATED by scripts/build-walzcraft-distributor-matches.py from /workspace/walz/*_vs_WalzCraft.csv. Do not edit by hand.\n'
ts+='// Profile confidence % come straight from the CSV "confidence" column. The CSVs give no per-color %, so\n// colorMatchPct is null and colorEstimated is true for every row. doorName is null when no source names the code.\n'
ts+='import type { DistributorDoorMatch } from "./walzcraftDistributorMatchTypes";\n\n'
ts+='export const WALZCRAFT_DISTRIBUTOR_DOORS: DistributorDoorMatch[] = '+json.dumps(doors,indent=2,ensure_ascii=False)+';\n'
open(os.path.join(ROOT,'shared/walzcraftDistributorMatchesData.ts'),'w').write(ts)
from collections import Counter
c=Counter((d['distributor'],d['photo'] is not None) for d in doors)
for d in LABEL.values(): print(d,'photo',c[(d,True)],'missing',c[(d,False)])
print('no name',[d['id'] for d in doors if not d['doorName']]); print('no color',[d['id'] for d in doors if not d['walzcraftColor']])
