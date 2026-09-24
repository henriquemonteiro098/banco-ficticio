#!/usr/bin/env python3
"""
generate_assets.py — Gerador de Assets Visuais 1k para Banco Fictício
Produz:
  - public/assets/cartao_black_texture.png (1024x645 px)
  - public/assets/banner_cofre_tesouraria.png (1024x384 px)
  - public/assets/avatars/avatar-[1..8].png (512x512 px)
  - public/assets/operacoes/op-[pix,transferencia,deposito,saque,pagamento].png (512x512 px)
"""

import os
import math
import random
from PIL import Image, ImageDraw, ImageFilter, ImageChops

ASSETS_DIR = "/Users/henriquemonteiro/Projetos/banco-ficticio/public/assets"
AVATARS_DIR = os.path.join(ASSETS_DIR, "avatars")
OPERACOES_DIR = os.path.join(ASSETS_DIR, "operacoes")

os.makedirs(AVATARS_DIR, exist_ok=True)
os.makedirs(OPERACOES_DIR, exist_ok=True)


# -----------------------------------------------------------------------------
# Utilitários de Desenho e Gradientes
# -----------------------------------------------------------------------------
def create_radial_gradient(width, height, center_x, center_y, radius, color_inner, color_outer):
    """Gera máscara de gradiente radial suave."""
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Amostra em passos
    steps = 100
    for i in range(steps, 0, -1):
        r = radius * (i / steps)
        t = i / steps
        # Interpolação de cor e alpha
        rgba = tuple(int(color_inner[c] * (1 - t) + color_outer[c] * t) for c in range(4))
        bbox = [center_x - r, center_y - r, center_x + r, center_y + r]
        draw.ellipse(bbox, fill=rgba)
    return img


# -----------------------------------------------------------------------------
# 1. Cartão Black Texture (1024 x 645 px)
# -----------------------------------------------------------------------------
def generate_cartao_black():
    w, h = 1024, 645
    print(f"Gerando Cartão Black Texture ({w}x{h})...")

    # Base profunda: gradiente linear obsidian escuro
    base = Image.new("RGBA", (w, h), (10, 13, 20, 255))
    draw = ImageDraw.Draw(base)

    for y in range(h):
        factor = y / h
        r = int(14 * (1 - factor) + 6 * factor)
        g = int(17 * (1 - factor) + 8 * factor)
        b = int(27 * (1 - factor) + 14 * factor)
        draw.line([(0, y), (w, y)], fill=(r, g, b, 255))

    # Trama de Fibra de Carbono 2x2 Twill procedural
    # Criamos um bloco mestre 16x16 com micro-fios e entrelaçamento
    tile_size = 16
    tile = Image.new("RGBA", (tile_size, tile_size), (0, 0, 0, 0))
    tile_draw = ImageDraw.Draw(tile)

    for i in range(tile_size):
        for j in range(tile_size):
            # Lógica 2x2 twill
            val_x = (i // 4) % 2
            val_y = (j // 4) % 2
            diag = ((i + j) // 4) % 2

            if diag == 0:
                # Trama horizontal refletiva
                strand = (j % 4)
                lum = 22 + (strand * 4) + ((i % 4) * 2)
                tile_draw.point((i, j), fill=(lum, lum + 2, lum + 6, 255))
            else:
                # Trama vertical com sombra cruzada
                strand = (i % 4)
                lum = 12 + (strand * 3) + ((j % 4) * 2)
                tile_draw.point((i, j), fill=(lum, lum + 1, lum + 4, 255))

    # Aplica o padrão ladrilhado sobre a superfície
    weave = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for x_offset in range(0, w, tile_size):
        for y_offset in range(0, h, tile_size):
            weave.paste(tile, (x_offset, y_offset))

    # Mescla a textura de fibra com transparência sutil
    base = Image.blend(base, weave, 0.45)

    # Elementos geométricos dourados sutis (veios de ouro / circuitos de segurança)
    gold_layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    gold_draw = ImageDraw.Draw(gold_layer)

    # Arcos circulares dourados sutis no canto inferior direito
    center_gold = (w + 120, h + 80)
    for r in [280, 360, 480, 520, 680, 820]:
        gold_color = (212, 175, 55, 35)
        gold_draw.arc([center_gold[0] - r, center_gold[1] - r, center_gold[0] + r, center_gold[1] + r],
                      start=170, end=280, fill=gold_color, width=2)

    # Linhas de microcircuito dourado no quadrante superior
    circuit_color = (229, 184, 59, 45)
    points_circuit = [
        [(60, 140), (220, 140), (280, 200), (450, 200)],
        [(100, 180), (200, 180), (240, 220), (380, 220)],
        [(750, 80), (840, 80), (890, 130), (980, 130)],
    ]
    for pts in points_circuit:
        gold_draw.line(pts, fill=circuit_color, width=2)
        for pt in pts:
            gold_draw.ellipse([pt[0]-3, pt[1]-3, pt[0]+3, pt[1]+3], fill=(245, 215, 110, 70))

    # Brilho dourado suave via Gaussian Blur
    gold_glow = gold_layer.filter(ImageFilter.GaussianBlur(radius=3))
    base = Image.alpha_composite(base, gold_glow)
    base = Image.alpha_composite(base, gold_layer)

    # Camada de iluminação glassmorphic ambiente
    light_layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))

    # Luz de realce violeta/índigo no canto superior direito
    indigo_light = create_radial_gradient(w, h, 880, 80, 420, (99, 102, 241, 70), (99, 102, 241, 0))
    light_layer = Image.alpha_composite(light_layer, indigo_light)

    # Luz esmeralda sutil no canto inferior esquerdo (ambient bounce)
    emerald_light = create_radial_gradient(w, h, 140, 560, 360, (16, 185, 129, 35), (16, 185, 129, 0))
    light_layer = Image.alpha_composite(light_layer, emerald_light)

    # Brilho especular sutil na borda superior (reflexo de vidro biselado)
    specular = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    spec_draw = ImageDraw.Draw(specular)
    spec_draw.line([(0, 1), (w, 1)], fill=(255, 255, 255, 45), width=2)
    spec_draw.line([(0, 2), (w, 2)], fill=(212, 175, 55, 30), width=1)
    light_layer = Image.alpha_composite(light_layer, specular)

    base = Image.alpha_composite(base, light_layer)

    # Vinheta perimetral para profundidade física
    vignette = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    vig_draw = ImageDraw.Draw(vignette)
    for step in range(30):
        alpha = int((30 - step) * 2.2)
        vig_draw.rectangle([step, step, w - step - 1, h - step - 1], outline=(2, 6, 23, alpha))
    base = Image.alpha_composite(base, vignette)

    output_path = os.path.join(ASSETS_DIR, "cartao_black_texture.png")
    base.save(output_path, "PNG", optimize=True)
    size_kb = os.path.getsize(output_path) / 1024
    print(f"✓ Salvo: {output_path} ({size_kb:.1f} KB)")
    return output_path


# -----------------------------------------------------------------------------
# 2. Banner Cofre Digital & Tesouraria (1024 x 384 px)
# -----------------------------------------------------------------------------
def generate_banner_cofre():
    w, h = 1024, 384
    print(f"Gerando Banner Cofre Tesouraria ({w}x{h})...")

    # Base: azul escuro slate/noite
    base = Image.new("RGBA", (w, h), (2, 6, 23, 255))
    draw = ImageDraw.Draw(base)

    # Gradiente de fundo sutil
    for y in range(h):
        ratio = y / h
        r = int(2 * (1 - ratio) + 11 * ratio)
        g = int(6 * (1 - ratio) + 17 * ratio)
        b = int(23 * (1 - ratio) + 38 * ratio)
        draw.line([(0, y), (w, y)], fill=(r, g, b, 255))

    # Linhas de perspectiva do piso da abóbada (grade cibernética)
    grid_layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    grid_draw = ImageDraw.Draw(grid_layer)

    vanishing_x = 760
    vanishing_y = 192

    # Linhas radiais de perspectiva do piso e teto
    for angle_deg in range(-60, 65, 8):
        rad = math.radians(angle_deg)
        x_end = vanishing_x - math.cos(rad) * 900
        y_end = vanishing_y + math.sin(rad) * 600
        grid_draw.line([(vanishing_x, vanishing_y), (x_end, y_end)], fill=(30, 41, 59, 45), width=1)

    # Linhas horizontais com espaçamento logarítmico (profundidade)
    for dist in [20, 45, 75, 115, 165, 230]:
        y_bot = vanishing_y + dist
        if y_bot < h:
            grid_draw.line([(0, y_bot), (w, y_bot)], fill=(51, 65, 85, 35), width=1)
        y_top = vanishing_y - dist
        if y_top > 0:
            grid_draw.line([(0, y_top), (w, y_top)], fill=(51, 65, 85, 30), width=1)

    base = Image.alpha_composite(base, grid_layer)

    # Cofre Digital Cibernético (Lado Direito: centro em 800, 192)
    vault_layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    v_draw = ImageDraw.Draw(vault_layer)

    vx, vy = 810, 192

    # Anéis concêntricos da porta de titânio
    rings = [
        (170, (30, 41, 59, 140), 6),       # Moldura externa reforçada
        (150, (51, 65, 85, 180), 4),       # Aro de rolamento
        (130, (15, 23, 42, 220), 8),       # Canal dos trincos
        (110, (14, 165, 233, 160), 2),     # Circuito ciano brilhante
        (90,  (16, 185, 129, 170), 3),     # Indicador de segurança esmeralda
        (65,  (30, 41, 59, 230), 5),       # Núcleo de aço escovado
        (45,  (6, 182, 212, 200), 2),      # Anel de biometria interna
        (25,  (16, 185, 129, 240), 3),     # Íris central ativa
    ]

    for radius, color, width in rings:
        v_draw.ellipse([vx - radius, vy - radius, vx + radius, vy + radius], outline=color, width=width)

    # Trincos e parafusos radiais de travamento pesado (16 parafusos no anel de raio 140)
    for bolt_idx in range(16):
        angle = bolt_idx * (2 * math.pi / 16)
        bx = vx + math.cos(angle) * 140
        by = vy + math.sin(angle) * 140
        v_draw.ellipse([bx - 6, by - 6, bx + 6, by + 6], fill=(100, 116, 139, 220), outline=(203, 213, 225, 200))
        # Parafuso interno
        v_draw.ellipse([bx - 2, by - 2, bx + 2, by + 2], fill=(15, 23, 42, 255))

    # Raios e dentes de engrenagem interna
    for spoke in range(8):
        angle = spoke * (2 * math.pi / 8) + (math.pi / 16)
        x1 = vx + math.cos(angle) * 65
        y1 = vy + math.sin(angle) * 65
        x2 = vx + math.cos(angle) * 105
        y2 = vy + math.sin(angle) * 105
        v_draw.line([(x1, y1), (x2, y2)], fill=(99, 102, 241, 140), width=3)

    # Marcadores de status cibernético no cofre (leds digitais)
    for led in range(24):
        angle = led * (2 * math.pi / 24)
        lx = vx + math.cos(angle) * 88
        ly = vy + math.sin(angle) * 88
        led_color = (16, 185, 129, 230) if led % 3 != 0 else (6, 182, 212, 230)
        v_draw.ellipse([lx - 2, ly - 2, lx + 2, ly + 2], fill=led_color)

    # Brilho central da íris
    center_glow = create_radial_gradient(w, h, vx, vy, 110, (6, 182, 212, 90), (16, 185, 129, 0))
    vault_layer = Image.alpha_composite(center_glow, vault_layer)

    base = Image.alpha_composite(base, vault_layer)

    # Linhas de fluxo de dados saindo do cofre para o banco (à esquerda)
    stream_layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(stream_layer)

    streams = [
        [(vx - 170, vy - 40), (550, vy - 40), (480, 80), (150, 80)],
        [(vx - 170, vy), (580, vy), (520, vy + 60), (200, vy + 60)],
        [(vx - 170, vy + 50), (620, vy + 50), (540, 310), (100, 310)],
    ]
    for stream in streams:
        s_draw.line(stream, fill=(14, 165, 233, 40), width=2)
        for pt in stream:
            s_draw.ellipse([pt[0]-3, pt[1]-3, pt[0]+3, pt[1]+3], fill=(16, 185, 129, 65))

    base = Image.alpha_composite(base, stream_layer)

    # ─────────────────────────────────────────────────────────────────────────
    # OVERLAY DE CONTRASTE RIGOROSO (WCAG AA >= 4.5:1 para os textos da esquerda)
    # Gradiente escuro: 0px a 500px com forte opacidade para leitura perfeita
    # ────────────────────────────────────────────────-------------------------
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    o_draw = ImageDraw.Draw(overlay)

    for x in range(w):
        # Transição da esquerda (muito escura, protegendo título) para direita (visível)
        if x < 420:
            # Opacidade 92% a 85%
            alpha = int(235 - (x / 420) * 20)
        elif x < 720:
            # Opacidade decrescendo suavemente
            t = (x - 420) / 300
            alpha = int(215 * (1 - t) + 100 * t)
        else:
            # Área do cofre mantém visual brilhante com leve escurecimento
            t = (x - 720) / (w - 720)
            alpha = int(100 * (1 - t) + 40 * t)

        o_draw.line([(x, 0), (x, h)], fill=(2, 6, 23, alpha))

    base = Image.alpha_composite(base, overlay)

    # Moldura sutil com borda tecnológica
    border = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    b_draw = ImageDraw.Draw(border)
    b_draw.rectangle([0, 0, w - 1, h - 1], outline=(30, 41, 59, 120), width=1)
    b_draw.line([(0, 0), (w, 0)], fill=(99, 102, 241, 70), width=1)
    base = Image.alpha_composite(base, border)

    output_path = os.path.join(ASSETS_DIR, "banner_cofre_tesouraria.png")
    base.save(output_path, "PNG", optimize=True)
    size_kb = os.path.getsize(output_path) / 1024
    print(f"✓ Salvo: {output_path} ({size_kb:.1f} KB)")
    return output_path


# -----------------------------------------------------------------------------
# 3. Avatares de Clientes (512 x 512 px)
# -----------------------------------------------------------------------------
def generate_client_avatars():
    print("Gerando Avatares Corporativos para Clientes...")

    # Perfis correspondentes ao seed do banco de dados:
    # 1: Ana Paula Souza (Executive Indigo)
    # 2: Bruno Costa Lima (Corporate Slate/Violet)
    # 3: Carla Mendes Ferreira (Wealth Amber/Gold)
    # 4: Diego Alves Ribeiro (Tech Cyan/Slate)
    # 5: Elena Martins Castro (Director Purple/Rose)
    # 6: Felipe Rocha Santos (Institutional Emerald)
    # 7: Gabriela Pinto Dias (Private Banking Bronze)
    # 8: Henrique Moura Cardoso (Treasury Sapphire)

    profiles = [
        {"id": 1, "nome": "Ana Paula Souza", "bg1": (30, 27, 75), "bg2": (67, 56, 202), "accent": (129, 140, 248), "hair": "fem_long", "tone": (245, 215, 195)},
        {"id": 2, "nome": "Bruno Costa Lima", "bg1": (15, 23, 42), "bg2": (51, 65, 85), "accent": (99, 102, 241), "hair": "masc_short", "tone": (230, 195, 175)},
        {"id": 3, "nome": "Carla Mendes Ferreira", "bg1": (36, 26, 12), "bg2": (180, 83, 9), "accent": (251, 191, 36), "hair": "fem_bob", "tone": (240, 210, 190)},
        {"id": 4, "nome": "Diego Alves Ribeiro", "bg1": (8, 47, 73), "bg2": (14, 116, 144), "accent": (56, 189, 248), "hair": "masc_crop", "tone": (215, 180, 155)},
        {"id": 5, "nome": "Elena Martins Castro", "bg1": (59, 7, 100), "bg2": (126, 34, 206), "accent": (216, 180, 254), "hair": "fem_bun", "tone": (242, 215, 200)},
        {"id": 6, "nome": "Felipe Rocha Santos", "bg1": (6, 78, 59), "bg2": (5, 150, 105), "accent": (52, 211, 153), "hair": "masc_wave", "tone": (200, 160, 135)},
        {"id": 7, "nome": "Gabriela Pinto Dias", "bg1": (69, 26, 3), "bg2": (180, 83, 9), "accent": (245, 158, 11), "hair": "fem_curl", "tone": (240, 205, 185)},
        {"id": 8, "nome": "Henrique Moura Cardoso", "bg1": (23, 37, 84), "bg2": (29, 78, 216), "accent": (96, 165, 250), "hair": "masc_part", "tone": (235, 205, 185)},
    ]

    size = 512
    generated_files = []

    for prof in profiles:
        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)

        # Fundo circular com gradiente moderno
        mask_circle = Image.new("L", (size, size), 0)
        mask_draw = ImageDraw.Draw(mask_circle)
        cx, cy = size // 2, size // 2
        r_outer = size // 2 - 16
        mask_draw.ellipse([cx - r_outer, cy - r_outer, cx + r_outer, cy + r_outer], fill=255)

        # Gradiente de fundo do perfil
        bg_img = Image.new("RGBA", (size, size), prof["bg1"] + (255,))
        bg_draw = ImageDraw.Draw(bg_img)
        for y in range(size):
            t = y / size
            cr = int(prof["bg1"][0] * (1 - t) + prof["bg2"][0] * t)
            cg = int(prof["bg1"][1] * (1 - t) + prof["bg2"][1] * t)
            cb = int(prof["bg1"][2] * (1 - t) + prof["bg2"][2] * t)
            bg_draw.line([(0, y), (size, y)], fill=(cr, cg, cb, 255))

        # Adiciona iluminação suave no topo do círculo
        glow = create_radial_gradient(size, size, cx, cy - 80, 220, prof["accent"] + (90,), prof["accent"] + (0,))
        bg_img = Image.alpha_composite(bg_img, glow)

        # Silhueta de busto corporativo estilizado e minimalista (sem imperfeições de dedos/olhos)
        # Ombros e terno executivo
        bust_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        bust_draw = ImageDraw.Draw(bust_layer)

        # Terno / Jaqueta profissional
        suit_color = (15, 23, 42, 255)
        bust_draw.ellipse([cx - 150, cy + 90, cx + 150, cy + 340], fill=suit_color)

        # Colarinho / Camisa
        shirt_color = (248, 250, 252, 255)
        bust_draw.polygon([(cx - 45, cy + 90), (cx, cy + 160), (cx + 45, cy + 90)], fill=shirt_color)

        # Gravata ou lapela corporativa sutil
        bust_draw.polygon([(cx - 12, cy + 120), (cx, cy + 240), (cx + 12, cy + 120)], fill=prof["accent"] + (230,))

        # Pescoço
        neck_tone = tuple(max(0, c - 20) for c in prof["tone"]) + (255,)
        bust_draw.rectangle([cx - 24, cy + 50, cx + 24, cy + 105], fill=neck_tone)

        # Cabeça / Rosto (perfil moderno flat limpo)
        face_tone = prof["tone"] + (255,)
        bust_draw.ellipse([cx - 65, cy - 85, cx + 65, cy + 65], fill=face_tone)

        # Cabelo estilizado de acordo com o perfil
        hair_color = (30, 27, 40, 255) if prof["id"] % 2 == 0 else (45, 30, 20, 255)
        if "fem" in prof["hair"]:
            # Cabelo feminino estilizado
            bust_draw.ellipse([cx - 75, cy - 105, cx + 75, cy + 30], fill=hair_color)
            bust_draw.ellipse([cx - 60, cy - 80, cx + 60, cy + 60], fill=face_tone)  # redefine face
            # Laterais
            bust_draw.ellipse([cx - 78, cy - 50, cx - 45, cy + 100], fill=hair_color)
            bust_draw.ellipse([cx + 45, cy - 50, cx + 78, cy + 100], fill=hair_color)
            # Franja
            bust_draw.ellipse([cx - 70, cy - 105, cx + 70, cy - 35], fill=hair_color)
        else:
            # Cabelo masculino estilizado
            bust_draw.ellipse([cx - 70, cy - 105, cx + 70, cy - 30], fill=hair_color)

        bg_img = Image.alpha_composite(bg_img, bust_layer)

        # Aplica a máscara circular
        img.paste(bg_img, (0, 0), mask_circle)

        # Aro de acabamento externo (borda dourada ou índigo com brilho metálico)
        ring_draw = ImageDraw.Draw(img)
        ring_draw.ellipse([cx - r_outer, cy - r_outer, cx + r_outer, cy + r_outer],
                          outline=prof["accent"] + (180,), width=4)
        ring_draw.ellipse([cx - r_outer + 3, cy - r_outer + 3, cx + r_outer - 3, cy + r_outer - 3],
                          outline=(255, 255, 255, 40), width=1)

        filename = f"avatar-{prof['id']}.png"
        out_path = os.path.join(AVATARS_DIR, filename)
        img.save(out_path, "PNG", optimize=True)
        size_kb = os.path.getsize(out_path) / 1024
        print(f"✓ Avatar cliente {prof['id']} ({prof['nome']}): {filename} ({size_kb:.1f} KB)")
        generated_files.append(out_path)

    return generated_files


# -----------------------------------------------------------------------------
# 4. Ícones / Badges Ilustrativos de Operações (512 x 512 px)
# -----------------------------------------------------------------------------
def generate_operation_badges():
    print("Gerando Badges de Operações Financeiras...")

    badges = [
        {"name": "op-pix.png", "tipo": "pix", "cor1": (6, 78, 59), "cor2": (5, 150, 105), "accent": (52, 211, 153)},
        {"name": "op-transferencia.png", "tipo": "ted", "cor1": (30, 27, 75), "cor2": (67, 56, 202), "accent": (129, 140, 248)},
        {"name": "op-deposito.png", "tipo": "deposito", "cor1": (6, 78, 59), "cor2": (16, 185, 129), "accent": (110, 231, 183)},
        {"name": "op-saque.png", "tipo": "saque", "cor1": (69, 26, 3), "cor2": (217, 119, 6), "accent": (251, 191, 36)},
        {"name": "op-pagamento.png", "tipo": "pagamento", "cor1": (49, 46, 129), "cor2": (14, 165, 233), "accent": (56, 189, 248)},
    ]

    size = 512
    generated_files = []

    for b in badges:
        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        cx, cy = size // 2, size // 2
        r = size // 2 - 20

        # Máscara de canto arredondado (squircle) moderno
        squircle = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        sq_draw = ImageDraw.Draw(squircle)
        sq_draw.rounded_rectangle([20, 20, size - 20, size - 20], radius=90, fill=b["cor1"] + (255,), outline=b["accent"] + (180,), width=4)

        # Gradiente interno
        grad = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        g_draw = ImageDraw.Draw(grad)
        for y in range(20, size - 20):
            t = (y - 20) / (size - 40)
            cr = int(b["cor1"][0] * (1 - t) + b["cor2"][0] * t)
            cg = int(b["cor1"][1] * (1 - t) + b["cor2"][1] * t)
            cb = int(b["cor1"][2] * (1 - t) + b["cor2"][2] * t)
            g_draw.line([(24, y), (size - 24, y)], fill=(cr, cg, cb, 255))

        # Máscara para manter dentro do squircle
        sq_mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(sq_mask).rounded_rectangle([20, 20, size - 20, size - 20], radius=90, fill=255)
        img.paste(grad, (0, 0), sq_mask)

        # Brilho de realce radial
        glow = create_radial_gradient(size, size, cx, cy - 40, 180, b["accent"] + (110,), b["accent"] + (0,))
        img = Image.alpha_composite(img, glow)

        # Desenho do símbolo central vetorial
        sym_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        sym_draw = ImageDraw.Draw(sym_layer)

        if b["tipo"] == "pix":
            # Losango / diamante dinâmico do PIX
            pts = [(cx, cy - 110), (cx + 110, cy), (cx, cy + 110), (cx - 110, cy)]
            sym_draw.polygon(pts, fill=b["accent"] + (240,), outline=(255, 255, 255, 220))
            inner_pts = [(cx, cy - 65), (cx + 65, cy), (cx, cy + 65), (cx - 65, cy)]
            sym_draw.polygon(inner_pts, fill=b["cor1"] + (255,), outline=b["accent"] + (255,))

        elif b["tipo"] == "ted":
            # Setas bidirecionais elegantes
            sym_draw.arc([cx - 90, cy - 90, cx + 90, cy + 90], start=30, end=150, fill=b["accent"] + (255,), width=18)
            sym_draw.arc([cx - 90, cy - 90, cx + 90, cy + 90], start=210, end=330, fill=(255, 255, 255, 240), width=18)
            # Pontas das setas
            sym_draw.polygon([(cx - 90, cy + 30), (cx - 65, cy), (cx - 115, cy)], fill=b["accent"] + (255,))
            sym_draw.polygon([(cx + 90, cy - 30), (cx + 115, cy), (cx + 65, cy)], fill=(255, 255, 255, 240))

        elif b["tipo"] == "deposito":
            # Seta ascendente com cofre
            sym_draw.rectangle([cx - 75, cy + 20, cx + 75, cy + 100], fill=(255, 255, 255, 220), outline=b["accent"] + (255,), width=4)
            sym_draw.polygon([(cx, cy - 100), (cx + 65, cy), (cx + 25, cy), (cx + 25, cy + 40), (cx - 25, cy + 40), (cx - 25, cy), (cx - 65, cy)], fill=b["accent"] + (255,))

        elif b["tipo"] == "saque":
            # Terminal cédula / retirada
            sym_draw.rounded_rectangle([cx - 110, cy - 70, cx + 110, cy + 70], radius=15, fill=(255, 255, 255, 220), outline=b["accent"] + (255,), width=5)
            sym_draw.ellipse([cx - 35, cy - 35, cx + 35, cy + 35], fill=b["cor2"] + (255,))
            sym_draw.polygon([(cx, cy + 110), (cx + 45, cy + 60), (cx - 45, cy + 60)], fill=b["accent"] + (255,))

        elif b["tipo"] == "pagamento":
            # Código de barras estilizado
            for bar_x, bar_w in [(-90, 8), (-70, 16), (-40, 6), (-20, 22), (15, 10), (35, 18), (65, 8), (85, 14)]:
                sym_draw.rectangle([cx + bar_x, cy - 70, cx + bar_x + bar_w, cy + 70], fill=(255, 255, 255, 230))
            # Linha de escaneamento a laser ciano
            sym_draw.line([(cx - 110, cy), (cx + 110, cy)], fill=b["accent"] + (255,), width=6)

        img = Image.alpha_composite(img, sym_layer)

        # Borda externa com brilho
        b_draw = ImageDraw.Draw(img)
        b_draw.rounded_rectangle([20, 20, size - 20, size - 20], radius=90, outline=b["accent"] + (220,), width=3)

        out_path = os.path.join(OPERACOES_DIR, b["name"])
        img.save(out_path, "PNG", optimize=True)
        size_kb = os.path.getsize(out_path) / 1024
        print(f"✓ Badge de operação ({b['tipo']}): {b['name']} ({size_kb:.1f} KB)")
        generated_files.append(out_path)

    return generated_files


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    print("=== INICIANDO GERAÇÃO DE ASSETS VISUAIS 1K ===")
    generate_cartao_black()
    generate_banner_cofre()
    generate_client_avatars()
    generate_operation_badges()
    print("=== GERAÇÃO CONCLUÍDA COM SUCESSO ===")
