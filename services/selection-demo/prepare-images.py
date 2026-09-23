"""Refresh fixed catalog thumbnails; requires macOS sips, no runtime external requests."""
import concurrent.futures, hashlib, json, pathlib, subprocess, tempfile
ROOT = pathlib.Path(__file__).resolve().parent
OUT = ROOT / 'fixtures' / 'thumbnails'
OUT.mkdir(exist_ok=True)
# The catalog is the only source of allowed URLs; never accept request-supplied URLs.
raw = subprocess.check_output(['node', '--input-type=module', '-e', 'import {catalog} from "./domain.mjs"; console.log(JSON.stringify([...new Set(catalog.map(p=>p.public_product?.images?.[0]??p.illustration?.image))]));'], cwd=ROOT)
urls = json.loads(raw)
def prepare(url):
    if not url.startswith('https://cdn.ashley.com/assets/'):
        raise ValueError('Unexpected image source')
    name = hashlib.sha256(url.encode()).hexdigest()[:20] + '.jpg'
    with tempfile.TemporaryDirectory() as temp:
        original = pathlib.Path(temp) / 'original.jpg'
        subprocess.run(['curl', '--fail', '--silent', '--show-error', '--retry', '2', '--max-time', '45', '--max-filesize', '20971520', '--proto', '=https', '--output', str(original), url], check=True)
        target = pathlib.Path(temp) / name
        subprocess.run(['sips', '-Z', '400', '-s', 'format', 'jpeg', '-s', 'formatOptions', '45', str(original), '--out', str(target)], check=True, stdout=subprocess.DEVNULL)
        if target.stat().st_size > 100_000:
            raise ValueError('Thumbnail exceeds 100 KB')
        (OUT / name).write_bytes(target.read_bytes())
    return url, name
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    manifest = dict(pool.map(prepare, urls))
# Replace manifest only after every image succeeds.
(OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'images': len(manifest), 'bytes': sum((OUT / name).stat().st_size for name in manifest.values())}))
