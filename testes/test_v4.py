# -*- coding: utf-8 -*-
"""Testes da v4.0 (visual novo do painel). Conferem, no código e no site gerado, que o visual novo é só uma camada:
as regras de v4.css valem apenas com html.v4 (ou só pegam peças novas .v4-*), o painel antigo continua inteiro por baixo,
a troca de visual existe nos dois sentidos e o robô não muda. O comportamento na tela é conferido em painel/test/areas.js
(navegador de verdade, com dados de teste); nada aqui prova como o site aparece no GitHub Pages.
Rodar na pasta do projeto:  python -m unittest discover -s testes -v"""
import json
import os
import re
import unittest

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.join(AQUI, '..')
SRC = os.path.join(RAIZ, 'painel', 'src')


def ler(*p):
    with open(os.path.join(RAIZ, *p), encoding='utf-8') as f:
        return f.read()


def seletores(css):
    """Devolve os seletores de todas as regras (dentro e fora de @media), sem os de @keyframes."""
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    out, pilha, buf, i = [], [], '', 0
    while i < len(css):
        c = css[i]
        if c == '{':
            cab = buf.strip(); buf = ''
            pilha.append(cab)
            if not cab.startswith('@') and not any(p.startswith('@keyframes') for p in pilha[:-1]):
                out.extend(s.strip() for s in cab.split(',') if s.strip())
        elif c == '}':
            if pilha:
                pilha.pop()
            buf = ''
        else:
            buf += c
        i += 1
    return out


class TestCamada(unittest.TestCase):
    def test_regras_so_valem_no_visual_novo(self):
        sel = seletores(ler('painel', 'src', 'v4.css'))
        self.assertGreater(len(sel), 150)
        fora = [s for s in sel if not (s.startswith('html.v4') or s.startswith('html:not(.v4)') or re.match(r'^\.v4-[\w-]+', s))]
        self.assertEqual(fora, [], 'regras de v4.css que mexeriam no visual antigo')

    def test_pecas_novas_escondidas_no_antigo(self):
        css = ler('painel', 'src', 'v4.css')
        self.assertIn('.v4-subs,.v4-col,.v4-volta,.v4-ir-wrap{display:none}', css)
        self.assertIn('.v4-o{display:none}', css)
        self.assertIn('html:not(.v4) .v4-rod{display:block}', css)

    def test_ordem_e_fonte(self):
        b = ler('painel', 'build.py')
        self.assertIn("'ui_v311.js', 'ui_v4.js', 'ui_v401.js', 'main.js'", b)  # v4.0.1: ui_v401.js depois do ui_v4.js
        self.assertIn("rd('app.css') + '\\n' + rd('v4.css')", b)
        self.assertIn('family=Lexend+Deca', b)

    def test_troca_de_visual_nos_dois_sentidos(self):
        js = ler('painel', 'src', 'ui_v4.js')
        for t in ('Voltar ao visual antigo', 'Usar o visual novo', "A.setVisual('antigo')", "A.setVisual('novo')", "lsSet('visual'", "modo !== 'antigo'"):
            self.assertIn(t, js)
        # o padrão é o visual novo; o antigo só com a escolha guardada neste navegador
        self.assertIn("A.lsGet('visual', 'novo')", js)

    def test_nada_e_retirado_do_hoje(self):
        js = ler('painel', 'src', 'ui_v4.js')
        # só a faixa vazia (fxd-slot, cujo conteúdo vai para "O dia até agora") e a .mesa que ficou sem seções saem do lugar
        self.assertEqual(sorted(re.findall(r'(\w+)\.remove\(\)', js)), ['fx', 'mesa'])
        self.assertIn("if (mesa && !mesa.querySelector('section')) mesa.remove()", js)
        for i in ('#atencao', '#mercado-hoje', '#radar', '#agenda-decisiva', '#research', '#debate', '#ultimas', '.hx-g', 'nav.sumario', '.desde'):
            self.assertIn(i, js)

    def test_bloco_do_alto_e_os_assuntos(self):
        # v4.0.1: as barras por hora saíram a pedido do Lucas; o bloco do alto vem de ui_v401.js (Assuntos do momento)
        js = ler('painel', 'src', 'ui_v4.js')
        self.assertIn('(A.v4Hero || heroPadrao)', js)
        self.assertIn('A.v4Hero = function (fx)', ler('painel', 'src', 'ui_v401.js'))


class TestSiteGerado(unittest.TestCase):
    def test_site_tem_o_visual_novo_e_o_antigo(self):
        html = ler('site', 'index.html')
        self.assertIn('html.v4', html)
        self.assertIn('Voltar ao visual antigo', html)
        self.assertIn('family=Lexend+Deca', html)
        # o painel antigo continua no mesmo arquivo
        self.assertIn('.mesa-col', html)
        self.assertIn('Para começar o dia', html)

    def test_identidade_do_painel_bate(self):
        pj = json.loads(ler('site', 'painel.json'))
        m = re.search(r'PAINEL_BUILD\s*=\s*"([0-9a-f]{12})"', ler('site', 'index.html'))
        self.assertTrue(m)
        self.assertEqual(pj.get('build'), m.group(1))

    def test_robo_nao_muda(self):
        self.assertEqual(ler('.github', 'workflows', 'robo.yml'), ler('docs', 'workflow_robo.yml'))


if __name__ == '__main__':
    unittest.main()
