import base64, io, re
from flask import Flask, request, jsonify, make_response
from PyPDF2 import PdfReader

app = Flask(__name__)

def cors(resp):
    resp.headers['Access-Control-Allow-Origin'] = '*'
    resp.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    resp.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS, GET'
    return resp

@app.route('/health', methods=['GET'])
def health():
    return cors(jsonify(ok=True, service='summarize-rfp-v2', mode='multipart+json'))

@app.route('/summarize_rfp', methods=['OPTIONS'])
def preflight():
    return cors(make_response('', 204))

@app.route('/summarize_rfp', methods=['POST'])
def summarize_rfp():
    try:
        raw = None
        fname = 'document.pdf'

        # 1) Try multipart/form-data (file upload)
        if request.files:
            f = request.files.get('file')
            if f:
                fname = getattr(f, 'filename', fname) or fname
                raw = f.read()

        # 2) Fallback to JSON {filename, content: base64}
        if raw is None:
            data = request.get_json(force=True, silent=True) or {}
            b64 = data.get('content')
            fname = data.get('filename') or fname
            if b64:
                raw = base64.b64decode(b64)

        if not raw:
            return cors(jsonify(error='No file content received')), 400

        text, pages = extract_text(raw)
        html = render_html(fname, {
            'overview': (text[:700] or 'No extractable text.'),
            'buyer': take_lines(text, r'(Parks Canada|CanadaBuys|Owner|Agency|Department)'),
            'key_dates': take_lines(text, r'(Closing|Deadline|Time|Date)'),
            'deliverables': take_lines(text, r'(Deliverables?|Tasks|Services Required)'),
            'mandatory': take_lines(text, r'(Mandatory|MUST|Requirements)'),
            'evaluation': take_lines(text, r'(Evaluation|Basis of Selection|Rated Criteria)'),
            'submission': take_lines(text, r'(Submission|How to submit|Bidding)'),
            'risks': take_lines(text, r'(Security|Insurance|Liability|Risks?)'),
        })
        return cors(jsonify(summary_html=html, meta={'pages': pages, 'bytes': len(raw), 'mode': 'multipart+json'}))
    except Exception as e:
        return cors(jsonify(error=str(e))), 500

def extract_text(raw: bytes):
    try:
        reader = PdfReader(io.BytesIO(raw))
        pages = len(reader.pages)
        out = []
        for i in range(min(pages, 30)):
            try:
                out.append(reader.pages[i].extract_text() or '')
            except Exception:
                out.append('')
        return '\n'.join(out), pages
    except Exception:
        try:
            return raw.decode('utf-8', errors='replace'), 1
        except Exception:
            return '', 1

def take_lines(text, pattern, n=8):
    m = re.search(pattern, text, re.I)
    if not m: return ''
    start = m.start()
    chunk = text[start:start+3000]
    lines = [ln.strip() for ln in chunk.splitlines() if ln.strip()]
    return '\n'.join(lines[:n])

def escape_html(s): 
    return (s or '').replace('&','&amp;').replace('<','&lt;').replace('>','&gt;').replace('"','&quot;')

def section_html(title, body):
    if not body: return ''
    lines = [ln for ln in body.split('\n') if ln.strip()]
    if len(lines) > 1:
        items = ''.join(f'<li>{escape_html(ln)}</li>' for ln in lines)
        content = f'<ul>{items}</ul>'
    else:
        content = f'<p>{escape_html(lines[0])}</p>'
    return f'<section><h3>{escape_html(title)}</h3>{content}</section>'

def render_html(filename, s):
    parts = [
        f'<h2>Summary: {escape_html(filename)}</h2>',
        section_html('Overview', s.get('overview')),
        section_html('Buyer/Owner', s.get('buyer')),
        section_html('Key Dates', s.get('key_dates')),
        section_html('Scope & Deliverables', s.get('deliverables')),
        section_html('Mandatory / Compliance', s.get('mandatory')),
        section_html('Evaluation', s.get('evaluation')),
        section_html('Submission', s.get('submission')),
        section_html('Risks & Other Terms', s.get('risks')),
    ]
    return '\n'.join([p for p in parts if p])

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)
