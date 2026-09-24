/**
 * test/assets.test.js
 * Suíte de testes automatizados para assets visuais 1k, CSS responsivo e integridade do layout.
 * Executado nativamente via Node.js test runner (`node --test`).
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const ASSETS_DIR = path.join(PUBLIC_DIR, 'assets');

// Utilitário para ler dimensões de imagem PNG diretamente do header IHDR
function getPngDimensions(filePath) {
  const buf = fs.readFileSync(filePath);
  // PNG Magic: 89 50 4E 47 0D 0A 1A 0A
  assert.strictEqual(buf[0], 0x89, 'Não é um arquivo PNG válido');
  assert.strictEqual(buf.toString('ascii', 12, 16), 'IHDR', 'Chunk IHDR não encontrado');
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

test('1. Asset Cartão Black Texture 1k', async (t) => {
  const cardPath = path.join(ASSETS_DIR, 'cartao_black_texture.png');

  await t.test('Arquivo existe em public/assets/', () => {
    assert.ok(fs.existsSync(cardPath), 'cartao_black_texture.png deve existir');
  });

  await t.test('Dimensões são exatamente 1024x645 px (Proporção 1.586:1 ISO 7810 ID-1)', () => {
    const { width, height } = getPngDimensions(cardPath);
    assert.strictEqual(width, 1024, 'Largura deve ser 1024 px');
    assert.strictEqual(height, 645, 'Altura deve ser 645 px');
  });

  await t.test('Orçamento de peso de arquivo respeitado (< 500 KB)', () => {
    const stat = fs.statSync(cardPath);
    const sizeKb = stat.size / 1024;
    assert.ok(sizeKb > 10, 'Arquivo não pode ser vazio ou nulo');
    assert.ok(sizeKb < 500, `Tamanho do arquivo (${sizeKb.toFixed(1)} KB) excede 500 KB`);
  });
});

test('2. Asset Banner Cofre Tesouraria 1k', async (t) => {
  const bannerPath = path.join(ASSETS_DIR, 'banner_cofre_tesouraria.png');

  await t.test('Arquivo existe em public/assets/', () => {
    assert.ok(fs.existsSync(bannerPath), 'banner_cofre_tesouraria.png deve existir');
  });

  await t.test('Dimensões são exatamente 1024x384 px', () => {
    const { width, height } = getPngDimensions(bannerPath);
    assert.strictEqual(width, 1024, 'Largura deve ser 1024 px');
    assert.strictEqual(height, 384, 'Altura deve ser 384 px');
  });

  await t.test('Orçamento de peso de arquivo respeitado (< 500 KB)', () => {
    const stat = fs.statSync(bannerPath);
    const sizeKb = stat.size / 1024;
    assert.ok(sizeKb > 10, 'Arquivo não pode ser vazio ou nulo');
    assert.ok(sizeKb < 500, `Tamanho do arquivo (${sizeKb.toFixed(1)} KB) excede 500 KB`);
  });
});

test('3. Avatares Corporativos de Clientes', async (t) => {
  const avatarsDir = path.join(ASSETS_DIR, 'avatars');

  await t.test('Diretório de avatares existe', () => {
    assert.ok(fs.existsSync(avatarsDir), 'Diretório public/assets/avatars deve existir');
  });

  for (let i = 1; i <= 8; i++) {
    await t.test(`Avatar ${i} (avatar-${i}.png) é válido e < 200 KB`, () => {
      const avatarPath = path.join(avatarsDir, `avatar-${i}.png`);
      assert.ok(fs.existsSync(avatarPath), `avatar-${i}.png deve existir`);
      const { width, height } = getPngDimensions(avatarPath);
      assert.strictEqual(width, 512, 'Largura do avatar deve ser 512 px');
      assert.strictEqual(height, 512, 'Altura do avatar deve ser 512 px');
      const sizeKb = fs.statSync(avatarPath).size / 1024;
      assert.ok(sizeKb < 200, `Tamanho do avatar (${sizeKb.toFixed(1)} KB) excede 200 KB`);
    });
  }
});

test('4. Badges de Operações Financeiras', async (t) => {
  const operacoesDir = path.join(ASSETS_DIR, 'operacoes');
  const badges = ['op-pix.png', 'op-transferencia.png', 'op-deposito.png', 'op-saque.png', 'op-pagamento.png'];

  for (const badge of badges) {
    await t.test(`Badge ${badge} existe e tem dimensões 512x512`, () => {
      const badgePath = path.join(operacoesDir, badge);
      assert.ok(fs.existsSync(badgePath), `${badge} deve existir`);
      const { width, height } = getPngDimensions(badgePath);
      assert.strictEqual(width, 512);
      assert.strictEqual(height, 512);
    });
  }
});

test('5. Integração e Regras em public/styles.css', async (t) => {
  const stylesPath = path.join(PUBLIC_DIR, 'styles.css');
  const css = fs.readFileSync(stylesPath, 'utf8');

  await t.test('Classe .card-black-premium declarada com background-image', () => {
    assert.ok(css.includes('.card-black-premium'), 'Classe .card-black-premium deve existir');
    assert.ok(css.includes('/assets/cartao_black_texture.png'), 'Referência a cartao_black_texture.png necessária');
  });

  await t.test('Classe .banner-tesouraria-bg declarada com background-image', () => {
    assert.ok(css.includes('.banner-tesouraria-bg'), 'Classe .banner-tesouraria-bg deve existir');
    assert.ok(css.includes('/assets/banner_cofre_tesouraria.png'), 'Referência a banner_cofre_tesouraria.png necessária');
  });

  await t.test('Contém media query responsiva para mobile', () => {
    assert.ok(css.includes('@media (max-width: 640px)'), 'Media query para mobile deve existir');
  });
});

test('6. Integração e Semântica em public/index.html', async (t) => {
  const indexPath = path.join(PUBLIC_DIR, 'index.html');
  const html = fs.readFileSync(indexPath, 'utf8');

  await t.test('Banner da Tesouraria aplicado no cabeçalho administrativo', () => {
    assert.ok(html.includes('banner-tesouraria-bg'), 'index.html deve aplicar banner-tesouraria-bg');
    assert.ok(html.includes('Cofre Digital &amp; Tesouraria') || html.includes('Cofre Digital & Tesouraria'), 'Título deve mencionar Cofre Digital & Tesouraria');
  });

  await t.test('Cartão Black Premium aplicado com preservação de IDs', () => {
    assert.ok(html.includes('card-black-premium'), 'index.html deve aplicar card-black-premium');
    assert.ok(html.includes('id="cardTipoConta"'), 'ID cardTipoConta deve ser preservado');
    assert.ok(html.includes('id="cardNumeroConta"'), 'ID cardNumeroConta deve ser preservado');
    assert.ok(html.includes('id="cardTitular"'), 'ID cardTitular deve ser preservado');
    assert.ok(html.includes('id="cardAgencia"'), 'ID cardAgencia deve ser preservado');
  });

  await t.test('Avatar de cliente aplicado com fallback de erro', () => {
    assert.ok(html.includes('id="clienteAvatar"'), 'ID clienteAvatar deve ser preservado');
    assert.ok(html.includes('/assets/avatars/avatar-1.png'), 'Avatar inicial referenciado');
  });
});

test('7. Entrega e Servimento Estático HTTP via Express', async (t) => {
  const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';

  const assetUrls = [
    '/assets/cartao_black_texture.png',
    '/assets/banner_cofre_tesouraria.png',
    '/assets/avatars/avatar-1.png',
    '/assets/operacoes/op-pix.png',
  ];

  for (const assetPath of assetUrls) {
    await t.test(`Servidor Express entrega ${assetPath} com status 200 e tipo image/png`, async () => {
      const res = await fetch(`${baseUrl}${assetPath}`);
      assert.strictEqual(res.status, 200, `Falha ao carregar ${assetPath}`);
      const contentType = res.headers.get('content-type');
      assert.ok(contentType && contentType.includes('image/png'), `Content-Type deve ser image/png para ${assetPath}`);
      const buf = Buffer.from(await res.arrayBuffer());
      assert.ok(buf.length > 1000, `Corpo da imagem ${assetPath} não pode ser vazio`);
      // Valida assinatura PNG
      assert.strictEqual(buf[0], 0x89);
      assert.strictEqual(buf[1], 0x50); // P
      assert.strictEqual(buf[2], 0x4E); // N
      assert.strictEqual(buf[3], 0x47); // G
    });
  }
});

