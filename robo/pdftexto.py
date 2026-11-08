"""Texto de PDF com a biblioteca padrão do Python (v3.6, Termômetro das cartas).

Lê os fluxos de conteúdo das páginas (FlateDecode via zlib), segue a fonte em uso (Tf) e traduz os códigos pelo mapa
ToUnicode da própria fonte quando existe (PDFs do Word e de editores modernos usam fontes CID). Serve para CONTAR
empresas citadas numa carta; não é um conversor completo: tabelas e colunas podem sair fora de ordem, e PDF escaneado
(imagem) não tem texto. Nada do texto é guardado pelo robô. Em qualquer falha devolve o que conseguiu (ou '')."""
import re
import zlib

_OBJ = re.compile(rb'(\d+)\s+(\d+)\s+obj\b(.*?)\bendobj', re.S)
_REF = rb'(\d+)\s+\d+\s+R'


def _stream(corpo):
    """Separa dicionário e fluxo de um objeto; descomprime FlateDecode."""
    i = corpo.find(b'stream')
    if i < 0:
        return corpo, None
    dic = corpo[:i]
    j = i + 6
    if corpo[j:j + 2] == b'\r\n':
        j += 2
    elif corpo[j:j + 1] in (b'\n', b'\r'):
        j += 1
    k = corpo.rfind(b'endstream')
    dados = corpo[j:k if k > j else len(corpo)]
    if b'FlateDecode' in dic:
        try:
            dados = zlib.decompress(dados)
        except zlib.error:
            try:
                dados = zlib.decompressobj().decompress(dados)
            except zlib.error:
                return dic, None
    elif re.search(rb'/Filter\s*/(DCT|JPX|CCITT|JBIG2|LZW|ASCII85|RunLength)', dic):
        return dic, None
    return dic, dados


def _objetos(pdf):
    objs = {}
    for m in _OBJ.finditer(pdf):
        dic, dados = _stream(m.group(3))
        objs[int(m.group(1))] = (dic, dados)
    # objetos dentro de fluxos de objetos (PDF 1.5+): "N First" e pares "num deslocamento"
    for num, (dic, dados) in list(objs.items()):
        if dados is None or b'/ObjStm' not in dic:
            continue
        try:
            n = int(re.search(rb'/N\s+(\d+)', dic).group(1))
            first = int(re.search(rb'/First\s+(\d+)', dic).group(1))
            nums = [int(v) for v in dados[:first].split()]
            pares = list(zip(nums[0::2], nums[1::2]))[:n]
            for i, (on, off) in enumerate(pares):
                fim = pares[i + 1][1] if i + 1 < len(pares) else len(dados) - first
                if on not in objs:
                    objs[on] = (dados[first + off:first + fim], None)
        except Exception:
            continue
    return objs


def _hex(s):
    s = re.sub(rb'\s', b'', s)
    if len(s) % 2:
        s += b'0'
    try:
        return bytes.fromhex(s.decode('ascii'))
    except ValueError:
        return b''


def _cmap(dados):
    """ToUnicode: {código (bytes): texto}, e a largura dos códigos (1 ou 2 bytes)."""
    mapa, larg = {}, 1
    m = re.search(rb'begincodespacerange\s*<([0-9A-Fa-f]+)>', dados)
    if m:
        larg = max(1, len(m.group(1)) // 2)
    for bloco in re.findall(rb'beginbfchar(.*?)endbfchar', dados, re.S):
        for a, b in re.findall(rb'<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]*)>', bloco):
            try:
                mapa[_hex(a)] = _hex(b).decode('utf-16-be', 'ignore')
            except Exception:
                pass
    for bloco in re.findall(rb'beginbfrange(.*?)endbfrange', dados, re.S):
        for a, b, rest in re.findall(rb'<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(\[[^\]]*\]|<[0-9A-Fa-f]*>)', bloco):
            ini, fim, w = int(a, 16), int(b, 16), len(a) // 2
            if fim - ini > 5000:
                continue
            if rest.startswith(b'['):
                alvos = re.findall(rb'<([0-9A-Fa-f]*)>', rest)
                for i, v in enumerate(alvos[:fim - ini + 1]):
                    mapa[(ini + i).to_bytes(w, 'big')] = _hex(v).decode('utf-16-be', 'ignore')
            else:
                base = _hex(rest[1:-1])
                try:
                    u = int.from_bytes(base, 'big')
                    for i in range(fim - ini + 1):
                        mapa[(ini + i).to_bytes(w, 'big')] = (u + i).to_bytes(len(base), 'big').decode('utf-16-be', 'ignore')
                except Exception:
                    pass
    return mapa, larg


def _literal(s):
    """String literal do PDF: (texto com \\n, \\( e octais \\ddd)."""
    out, i = bytearray(), 0
    while i < len(s):
        c = s[i]
        if c == 0x5C and i + 1 < len(s):  # barra invertida
            n = s[i + 1]
            esc = {0x6E: 10, 0x72: 13, 0x74: 9, 0x62: 8, 0x66: 12, 0x28: 0x28, 0x29: 0x29, 0x5C: 0x5C}
            if n in esc:
                out.append(esc[n]); i += 2; continue
            m = re.match(rb'[0-7]{1,3}', s[i + 1:i + 4])
            if m:
                out.append(int(m.group(0), 8) & 255); i += 1 + len(m.group(0)); continue
            i += 2; continue
        out.append(c); i += 1
    return bytes(out)


def _decodifica(b, fonte):
    if fonte and fonte[0]:
        mapa, larg = fonte
        return ''.join(mapa.get(b[i:i + larg], '') for i in range(0, len(b), larg))
    try:
        return b.decode('cp1252')
    except UnicodeDecodeError:
        return b.decode('latin-1', 'ignore')


_TOK = re.compile(rb'\((?:\\.|[^\\)])*\)|<[0-9A-Fa-f\s]*>|\[|\]|/[^\s/\[\]()<>]+|-?\d*\.?\d+|[A-Za-z\'"*]+', re.S)


def _texto_conteudo(dados, fontes):
    out, pilha, fonte, arr = [], [], None, None
    for t in _TOK.findall(dados):
        if t == b'[':
            arr = []
            continue
        if t == b']':
            pilha.append(('arr', arr or []))
            arr = None
            continue
        if t.startswith(b'('):
            v = ('str', _literal(t[1:-1]))
        elif t.startswith(b'<') and not t.startswith(b'<<'):
            v = ('str', _hex(t[1:-1]))
        elif t.startswith(b'/'):
            v = ('nome', t[1:])
        elif re.match(rb'-?\d*\.?\d+$', t):
            v = ('num', float(t))
        else:
            op = t
            if op == b'Tf':
                nomes = [p[1] for p in pilha if p[0] == 'nome']
                fonte = fontes.get(nomes[-1]) if nomes else None
            elif op in (b'Tj', b"'", b'"'):
                ss = [p[1] for p in pilha if p[0] == 'str']
                if ss:
                    out.append(_decodifica(ss[-1], fonte))
                if op != b'Tj':
                    out.append('\n')
            elif op == b'TJ':
                arrs = [p[1] for p in pilha if p[0] == 'arr']
                for e in (arrs[-1] if arrs else []):
                    if e[0] == 'str':
                        out.append(_decodifica(e[1], fonte))
                    elif e[0] == "num" and e[1] < -300:
                        out.append(' ')
            elif op in (b'Td', b'TD', b'T*', b'Tm', b'ET', b'BT'):
                out.append(' ' if op in (b'Td', b'Tm') else '\n')
            pilha = []
            continue
        if arr is not None:
            arr.append(v)
        else:
            pilha.append(v)
    return ''.join(out)


def _dic_de(objs, txt):
    """Dicionário inline ou referência a outro objeto."""
    m = re.match(rb'\s*' + _REF, txt)
    if m:
        return (objs.get(int(m.group(1))) or (b'', None))[0]
    return txt


def _fontes_da_pagina(objs, dic_pag, cache):
    """{nome do recurso: (mapa ToUnicode, largura)} das fontes da página."""
    m = re.search(rb'/Resources\s*(' + _REF + rb'|<<.*)', dic_pag, re.S)
    if not m:
        return {}
    res = _dic_de(objs, m.group(1))
    mf = re.search(rb'/Font\s*(' + _REF + rb'|<<(.*?)>>)', res, re.S)
    if not mf:
        return {}
    fontdic = _dic_de(objs, mf.group(1)) if re.match(rb'\s*' + _REF, mf.group(1)) else mf.group(1)
    out = {}
    for nome, ref in re.findall(rb'/([^\s/<>\[\]]+)\s+' + _REF, fontdic):
        num = int(ref)
        if num not in cache:
            fd = (objs.get(num) or (b'', None))[0]
            mt = re.search(rb'/ToUnicode\s+' + _REF, fd)
            cache[num] = _cmap((objs.get(int(mt.group(1))) or (b'', b''))[1] or b'') if mt else ({}, 1)
        out[nome] = cache[num]
    return out


def texto(pdf_bytes, max_paginas=30):
    try:
        objs = _objetos(pdf_bytes)
    except Exception:
        return ''
    paginas, cache, partes = [], {}, []
    for num in sorted(objs):
        dic = objs[num][0]
        if re.search(rb'/Type\s*/Page(?![s\w])', dic):
            paginas.append(dic)
    for dic in paginas[:max_paginas]:
        try:
            fontes = _fontes_da_pagina(objs, dic, cache)
            mc = re.search(rb'/Contents\s*(\[[^\]]*\]|' + _REF + rb')', dic)
            if not mc:
                continue
            refs = [int(r) for r in re.findall(_REF, mc.group(1))]
            # /Contents pode apontar para um array guardado em outro objeto
            if len(refs) == 1 and objs.get(refs[0]) and objs[refs[0]][1] is None:
                refs = [int(r) for r in re.findall(_REF, objs[refs[0]][0])] or refs
            for r in refs:
                dados = (objs.get(r) or (b'', None))[1]
                if dados:
                    partes.append(_texto_conteudo(dados, fontes))
            partes.append('\n')
        except Exception:
            continue
    return re.sub(r'[ \t]+', ' ', ''.join(partes))
