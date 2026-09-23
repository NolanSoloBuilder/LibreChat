import re,json,html,datetime
from pathlib import Path
import argparse
parser=argparse.ArgumentParser(description='Import public product cards from previously fetched official Ashley category HTML')
parser.add_argument('html_file',type=Path)
args=parser.parse_args()
root=Path(__file__).resolve().parent;p=root/'fixtures/ashley-public-products.json';data=json.loads(p.read_text());existing={x['official_sku']:x for x in data['products']}
s=html.unescape(args.html_file.read_text())
for chunk in re.split(r'(?=<li class="grid-tile[^\"]*"\s*data-colors)',s)[1:]:
 def attr(k):
  m=re.search(k+r'="([^"]*)"',chunk);return m.group(1) if m else None
 sku=attr('data-cnstrc-item-variation-id');name=attr('data-cnstrc-item-name')
 images=list(dict.fromkeys(re.findall(r'https://cdn\.ashley\.com/assets/[^"<>\s]+?\.jpg',chunk)))
 urls=re.findall(r'https://www\.ashleyfurniture\.com/p/[^"<>\s]+?\.html',chunk)
 if not sku or not name or not images or not urls or sku in existing:continue
 existing[sku]=dict(official_sku=sku,name=name,brand=None,color=attr('data-colors-to-show'),width_cm=None,width_in=None,public_price=attr('data-cnstrc-item-price'),public_currency='USD',images=images[:3],source_url=urls[0],collected_at=datetime.datetime.fromtimestamp(args.html_file.stat().st_mtime,datetime.timezone.utc).isoformat(),collection_method='Official category HTML snapshot; dimensions unavailable',notice='Public listing facts; operational dimensions and enterprise data are simulated where absent.')
data['products']=list(existing.values());p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');print('public products',len(existing))
