"""Refresh a bounded Ashley public-product snapshot; never import private stock or delivery promises."""
import json,re,subprocess,hashlib,datetime,concurrent.futures
from pathlib import Path
ROOT=Path(__file__).resolve().parent
SOURCE='https://www.ashleyfurniture.com/c/furniture/living-room/sofas/beige/'
def fetch(url):
 return subprocess.check_output(['curl','-Ls','--fail','--max-time','40','--retry','2','-A','Mozilla/5.0',url],text=True)
def parse(url):
 html=fetch(url)
 for raw in re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>',html,re.S):
  try: p=json.loads(raw)
  except ValueError:continue
  if not isinstance(p,dict) or p.get('@type')!='Product':continue
  offer=p.get('offers',{}); width=p.get('width',{})
  if width.get('unitCode')!='INH':continue
  images=[x for x in p.get('image',[]) if x.startswith('https://cdn.ashley.com/')]
  if not images:continue
  return dict(official_sku=p['sku'],name=p['name'],brand=p.get('brand',{}).get('name'),color=p.get('color'),width_in=width['value'],width_cm=round(float(width['value'])*2.54,2),images=images[:3],public_price=offer.get('price'),public_currency=offer.get('priceCurrency'),source_url=url,collected_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),source_hash=hashlib.sha256(html.encode()).hexdigest(),notice='Public US website snapshot; prices depend on location/date. No inference about China inventory or procurement costs.')
 raise ValueError('Missing usable structured public product: '+url)
def main():
 import argparse
 parser=argparse.ArgumentParser()
 parser.add_argument('--category-html',type=Path,help='Previously fetched official category HTML')
 args=parser.parse_args()
 html=args.category_html.read_text() if args.category_html else fetch(SOURCE)
 urls=list(dict.fromkeys(u for u in re.findall(r'href="([^"#]*?/p/[^"#]+?\.html)',html) if u.startswith('https://www.ashleyfurniture.com/') and 'sofa' in u and '-Master' not in u))[:12]
 items=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
  for u,r in zip(urls,pool.map(lambda u: safe(u),urls)):
   if r:items.append(r);print(r['official_sku'],r['name'],r['width_cm'],r['public_price'],r['public_currency'])
 if len(items)<3:raise RuntimeError('Need at least three verified public products; existing snapshot preserved')
 snapshot=ROOT/'fixtures/ashley-public-products.json'
 old=json.loads(snapshot.read_text()) if snapshot.exists() else {'products':[]}
 merged={p['official_sku']:p for p in old['products']}
 merged.update({p['official_sku']:p for p in items})
 items=list(merged.values())
 snapshot.write_text(json.dumps({'source':SOURCE,'data_mode':'public_website_snapshot','products':items},ensure_ascii=False,indent=2)+'\n')
def safe(url):
 try:return parse(url)
 except Exception as e:print(type(e).__name__,str(e)[:150]);return None
if __name__=='__main__':main()
