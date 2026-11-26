// ==============================================================================
// GERADOR NATIVO DE CÓDIGO DE BARRAS CODE 128B (SVG)
// Não necessita de bibliotecas externas pesadas; ultra-leve e nítido para impressão
// ==============================================================================

// Padrões de barras do Code 128 (larguras dos traços e espaços)
const CODE128_PATTERNS: string[] = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112"
];

const START_CODE_B = 104;
const STOP_CODE = 106;

/**
 * Converte uma string ASCII em sequência SVG de barras Code 128
 */
export function generateBarcode128Svg(
  text: string,
  width: number = 240,
  height: number = 70,
  showText: boolean = true
): string {
  if (!text) return '';

  const cleanText = text.trim();
  const codes: number[] = [START_CODE_B];

  for (let i = 0; i < cleanText.length; i++) {
    const charCode = cleanText.charCodeAt(i);
    // No Code 128B, valores 0-95 correspondem a ASCII 32-127
    const val = charCode - 32;
    if (val >= 0 && val <= 95) {
      codes.push(val);
    } else {
      codes.push(0); // Espaço substituto para caracteres fora da faixa
    }
  }

  // Cálculo do checksum ponderado
  let checksum = codes[0];
  for (let i = 1; i < codes.length; i++) {
    checksum += codes[i] * i;
  }
  codes.push(checksum % 103);
  codes.push(STOP_CODE);

  // Construir padrão de larguras
  let barPattern = '';
  for (const c of codes) {
    if (c >= 0 && c < CODE128_PATTERNS.length) {
      barPattern += CODE128_PATTERNS[c];
    }
  }

  // Calcular larguras individuais (barras e espaços alternados)
  const totalUnits = barPattern.split('').reduce((sum, n) => sum + parseInt(n, 10), 0);
  const unitWidth = width / totalUnits;

  let currentX = 0;
  let isBar = true;
  let rects = '';

  for (let i = 0; i < barPattern.length; i++) {
    const units = parseInt(barPattern[i], 10);
    const rectWidth = units * unitWidth;

    if (isBar) {
      rects += `<rect x="${currentX.toFixed(2)}" y="0" width="${rectWidth.toFixed(2)}" height="${height}" fill="#000000" />`;
    }

    currentX += rectWidth;
    isBar = !isBar;
  }

  const svgHeight = showText ? height + 18 : height;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${svgHeight}" width="${width}" height="${svgHeight}">
      <rect width="${width}" height="${svgHeight}" fill="#ffffff" />
      <g>${rects}</g>
      ${
        showText
          ? `<text x="${width / 2}" y="${height + 14}" text-anchor="middle" font-family="monospace, monospace" font-size="11" font-weight="700" fill="#000000">${cleanText}</text>`
          : ''
      }
    </svg>
  `;
}
