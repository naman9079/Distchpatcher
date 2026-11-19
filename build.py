from pathlib import Path
ROOT = Path(__file__).resolve().parent
html = (ROOT / 'src/template.html').read_text(encoding='utf-8')
for token, path in [('/*STYLES*/','src/styles.css'),('/*PLANNER*/','src/planner.js'),('/*CATALOG*/','src/catalog.js'),('/*LIFECYCLE*/','src/lifecycle.js'),('/*APP*/','src/app.js')]:
    html = html.replace(token, (ROOT / path).read_text(encoding='utf-8'))
(ROOT / 'index.html').write_text(html,encoding='utf-8')
print('Built index.html')
