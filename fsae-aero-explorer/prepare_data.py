import csv,json,math,shutil
from pathlib import Path

ROOT=Path(__file__).parent
UPLOAD=ROOT/'raw_data'
FILES={name:list(csv.reader((UPLOAD/name).open(encoding='utf-8-sig',newline=''))) for name in json.loads((UPLOAD/'manifest.json').read_text())}
WT='Copy of FORD TUNNEL DATA - AeroData.csv'
C26='Copy of 26 aeromap - combined_reports.csv'
C25='Copy of 26 aeromap - 25 CFD Data.csv'
COR='Copy of 26 aeromap - 26CFDDATA.csv'
OLD='Copy of 25 aeromap - Sheet1.csv'
MIX='Copy of 26 aeromap - Combined_reports_2.csv'
def num(x):
    try:
        n=float(str(x).replace(',',''))
        return n if math.isfinite(n) else None
    except: return None
def col(i):
    s='';i+=1
    while i:i,a=divmod(i-1,26);s=chr(65+a)+s
    return s
def fields(headers,row):
    return [{'column':col(i),'label':(headers[i] if i<len(headers) else '').replace('\n',' ').strip() or 'Unlabeled','value':v} for i,v in enumerate(row) if v!='']
def lookup(headers,row):
    return {h.strip():num(row[i]) for i,h in enumerate(headers) if h and i<len(row)}
records=[]
for idx,row in enumerate(FILES[WT]):
    if idx<13 or not row or num(row[0]) is None or num(row[5]) is None or num(row[5])<=0:continue
    a=lambda i:num(row[i]) if i<len(row) else None
    run=int(a(0));front=a(13);rear=a(15)
    rec=dict(id=f'WT-{run}-{int(a(3))}',source='WT',design='25 label / date unconfirmed',configuration=row[1].strip(),group='Baseline' if run<=6 else row[1].strip(),run=run,point=int(a(3)),yaw=a(4),speed=a(5)*.44704,mph=a(5),nominal=None,down=-a(11),drag=a(9),front=100*front/(front+rear),eff=-a(11)/a(9),side=a(18),pitch=a(19),ym=a(20),roll=a(21),downN=-a(57),dragN=a(56),sideN=a(62),pitchNm=a(63),ymNm=a(64),rollNm=a(65),frontN=-(a(58)+a(59)),rearN=-(a(60)+a(61)),corners=[-a(i) for i in [58,59,60,61]],area=a(55),density=None,qratio=a(22),q=a(7),temp=a(42),humidity=a(44),blcPressure=a(8),blcStatus=row[47],fanCurrent=a(53),fanRPM=a(54),order=idx+1,file=WT,row=idx+1,fields=fields(FILES[WT][9],row),aliases=[],components={})
    records.append(rec)

def cfd(file,rownum,headers,year,corrected=False):
    row=FILES[file][rownum-1];d=lookup(headers,row);g=lambda k:d.get(k)
    old=year=='25'; yaw=num(row[3 if old else 1]);speed=g('Simulation Velocity')
    down=abs(g('CFD CL') if old and g('CFD CL') is not None else g('-Cl') or g('2026 CFD CL') or 0)
    drag=g('Cd') if g('Cd') is not None else g('2026 CFD CD')
    rawdown=g('Downforce ALL'); rawdrag=g('Drag ALL');front=g('Percent downforce on front tire')
    if corrected:down=g('CL Corrected');drag=g('CD Corrected');front=None
    r=dict(id=f'{"COR" if corrected else "CFD"}-{year}-{rownum}',source='Corrected' if corrected else f'CFD {year}',design=year,configuration='Full car (CFD)',group='Full car (CFD)',run=row[0],point=None,yaw=yaw,speed=speed,mph=speed/.44704 if speed else None,nominal=None if old else num(row[2]),down=down,drag=drag,front=front,eff=down/drag if down is not None and drag else None,downN=None if corrected else rawdown,dragN=None if corrected else rawdrag,side=None,pitch=None,ym=None,roll=None,sideN=None,pitchNm=None,ymNm=None,rollNm=None,corners=None,area=g('Frontal area of the car'),density=g('Density of Air'),clCov=g('Cl CoV'),cdCov=g('Cd CoV'),balanceCov=g('AeroBalance CoV'),clMean=g('Cl Mean'),cdMean=g('Cd Mean'),iterationTime=g('Solver Iteration Elapsed Time'),totalTime=g('Total Solver Elapsed Time'),radiatorFlow=g('Radiator Mass Flow'),fanFlow=g('Fan volumetric flow rate'),CFL=g('CFL Number'),order=rownum,file=file,row=rownum,fields=fields(headers,row),aliases=[],components={} if corrected else {k:v for k,v in d.items() if k.startswith(('Downforce ','Drag ')) and v is not None},sourceCase=row[0],providedEfficiency=g('Aerodynamic Efficiency'))
    if corrected:
        r['baseDown']=g('2026 CFD CL');r['baseDrag']=g('2026 CFD CD');r['calibrationSpeed']=[10.41573536,13.00849352,15.60125168,18.10460438,20.69736254][rownum-2]
    return r

for rn in range(2,16):records.append(cfd(C25,rn,FILES[C25][0],'25'))
# The headerless legacy case uses the explicitly labeled matching block's layout.
legacy_headers=FILES[MIX][17]
for rn in [1,2,3,4,9,10,11,12,13]:
    row=FILES[OLD][rn-1];existing=next((r for r in records if r['source']=='CFD 25' and str(r['run'])==row[0]),None)
    if existing:existing['aliases'].append({'file':OLD,'row':rn})
    else:
        extra=cfd(OLD,rn,legacy_headers,'25')
        extra['id']=f'CFD-25-legacy-{rn}'
        records.append(extra)
seen={}
for rn,row in enumerate(FILES[C26],1):
    if not row or not row[0].startswith('Go4'):continue
    if row[0] in seen:seen[row[0]]['aliases'].append({'file':C26,'row':rn});continue
    r=cfd(C26,rn,FILES[C26][0],'26');seen[row[0]]=r;records.append(r)
for rn in range(2,7):records.append(cfd(COR,rn,FILES[COR][0],'26',True))

# Retain simulation identity but flag the repeated zero-yaw report rather than treating it as a repeatability sample.
for r in records:
    r['notes']=[]
    if r['source']=='CFD 25' and r['run']=='2.1':r['duplicateOf']='CFD-25-2';r['notes'].append('Same force and condition values as simulation 1.1; hidden from plots by default. Both source rows remain accessible.')
    if r['source']=='Corrected':r['notes'].append('Provided corrected coefficients only. No independently measured 26-car result is implied. Front/rear corrected outputs are available in original fields; not combined into a derived balance.')
    if r['source']=='WT':r['notes'].append('Ford metadata dates: 19 and 20 February 2026; comparison sheets label this data 25 WT. Design year is unconfirmed.')
    if r['source']=='CFD 25' and r['file']==OLD:r['notes'].append('Labels inferred from the matching labeled 25 CFD block in Combined_reports_2; original row retained.')

sources=[]
(ROOT/'dist'/'sources').mkdir(exist_ok=True)
for i,(name,rows) in enumerate(FILES.items()):
    target=f'sources/source-{i+1}.csv';shutil.copyfile(UPLOAD/name,ROOT/'dist'/target)
    sources.append({'name':name,'url':target,'rows':rows,'count':len(rows)})
data={'records':records,'sources':sources,'notes':['CSV snapshots are the source of truth for this dashboard. Original values are not repaired.','Blank cells and error text are missing, never zero.','WT velocity is converted from mph using 0.44704. CFD uses Simulation Velocity.','Positive downforce is plotted. WT front share = CLF/(CLF+CLR). CFD front share is the supplied percentage.','Efficiency is derived consistently as positive downforce coefficient / drag coefficient.','A connected line joins observed cases; it is not a fitted aerodynamic model.','The supplied corrected CFD is shown separately. CSV exports do not establish the correctness of the original calculation.']}
(ROOT/'dist'/'data.json').write_text(json.dumps(data,separators=(',',':'),allow_nan=False))
assert len([r for r in records if r['source']=='WT'])==72
assert len([r for r in records if r['source']=='CFD 26'])==12
assert len([r for r in records if r['source']=='Corrected'])==5
print('Prepared',len(records),'records and',len(sources),'complete CSV snapshots')
