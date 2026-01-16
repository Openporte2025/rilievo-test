// ═══════════════════════════════════════════════════════════════════════════════
// 🪟 DATABASE FINSTRAL/FINDOOR/FINWINDOW - Infissi, Portoncini, Telai
// ═══════════════════════════════════════════════════════════════════════════════

// 🆕 v4.79: Mappa codici taglio disponibili per tipo telaio (da catalogo Finstral EUR 2025/3)
const CODICI_TAGLIO_PER_TELAIO = {
    // Telai forma L
    '961': ['127', '107', '163', '162', '164', '165', '5N', '179N'],
    '962': ['127', '107', '161', '118', '163', '164', '165', '116', '167', '129', '132', '153', '5N', '179N', '172', '162', '166', '169'],
    '963': ['127', '107', '161', '162', '163', '164', '165', '105', '166', '170', '118', '134', '149', '172', '116', '129', '132', '167', '147', '148', '5N', '179N'],
    '924': ['127', '107', '163', '162', '164', '165', '5N', '179N'],
    '991': ['127', '107', '161', '118', '163', '164', '165', '116', '167', '129', '132', '5N', '179N', '172', '162', '166', '153', '133', '176'],
    '951': ['151', '156', '157', '119', '124', '152', '127', '121', '179N', '191', '192', '153'],
    // Telai forma Z
    '964': ['128', '110', '136', '179N', '5N'],
    '965': ['128', '110', '115', '100', '120', '125', '130', '140', '178', '179N', '5N'],
    '966': ['128', '110', '115', '100', '120', '125', '130', '135', '140', '145', '150', '160', '178', '179N', '5N'],
    '967': ['128', '131', '110', '179N', '5N'],
    // Telai Z62/Z91
    'Z62': ['128', '110', '179N', '5N'],
    'Z91': ['128', '110', '179N', '5N']
};

// Funzione helper per ottenere codici disponibili
function getCodiciTaglioPerTelaio(telaio) {
    return CODICI_TAGLIO_PER_TELAIO[telaio] || [];
}

// 🆕 v4.81: Genera array posizioni tagli da tagliTelaio (non serve più salvare codTagli)
function getPosizioniTagli(tagliTelaio) {
    const tagliMap = {
        'nessuno': [],
        'sopra': ['SOPRA'],
        'sotto': ['SOTTO'],
        'dx': ['DX'],
        'sx': ['SX'],
        'sopra-sotto': ['SOPRA', 'SOTTO'],
        'dx-sx': ['SX', 'DX'],
        '4-lati': ['SOPRA', 'SOTTO', 'SX', 'DX'],
        'sopra-laterali': ['SOPRA', 'SX', 'DX'],
        'sotto-laterali': ['SOTTO', 'SX', 'DX']
    };
    return tagliMap[tagliTelaio] || [];
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🚪 DATABASE PORTONCINI FINSTRAL FIN-DOOR - Listino EUR 2025/3 Marzo 2025
// ═══════════════════════════════════════════════════════════════════════════════

// 🆕 v5.23: MATERIALI DISPONIBILI (da listino pag. 196)
const FINDOOR_MATERIALI_INT = {
    'PVC': { cod: '1I4', desc: 'PVC', colori: 'PVC' },
    'ALU': { cod: '2I3', desc: 'Alluminio', colori: 'ALU' },
    'LEGNO': { cod: '4I4', desc: 'Legno', colori: 'LEGNO' }
    // Altri: vetro smaltato (5I4), ceramica (6I4), metallo (7I4) - non implementati
};

const FINDOOR_MATERIALI_EST = {
    'PVC': { cod: '1A6', desc: 'PVC', colori: 'PVC' },
    'ALU': { cod: '2A4', desc: 'Alluminio', colori: 'ALU' },
    'LEGNO': { cod: '4A4', desc: 'Legno', colori: 'LEGNO' }  // 🆕 v5.66: Aggiunto da listino 10/2025
    // Altri: vetro smaltato (5A4), ceramica (6A4) - non implementati
};

// 🆕 v5.66: COMBINAZIONI MATERIALI AGGIORNATE (da listino Finstral 10/2025)
// Ora ALU e LEGNO interno possono avere anche PVC esterno!
const FINDOOR_COMBINAZIONI = {
    'PVC': ['PVC', 'ALU', 'LEGNO'],      // PVC interno → PVC, ALU o LEGNO esterno
    'ALU': ['PVC', 'ALU', 'LEGNO'],      // ALU interno → PVC, ALU o LEGNO esterno (🆕 PVC aggiunto)
    'LEGNO': ['PVC', 'ALU']              // LEGNO interno → PVC o ALU esterno (🆕 PVC aggiunto)
};

// 🆕 v5.23: COLORI LEGNO (da listino pag. 14 - gruppi colori legno per telai 9705/9706)
// Supplementi variano per telaio: 9705 ha prezzi più bassi, 9706 più alti
const FINDOOR_COLORI_LEGNO = {
    'gruppo0': {
        desc: 'Gruppo 0 (base)',
        suppl9705: 53.0,
        suppl9706: 59.6,
        colori: ['Rovere naturale', 'Faggio naturale', 'Acero naturale']
    },
    'gruppo1': {
        desc: 'Gruppo 1',
        suppl9705: 58.9,
        suppl9706: 65.5,
        colori: ['Rovere tinto', 'Noce', 'Ciliegio']
    },
    'gruppo2': {
        desc: 'Gruppo 2',
        suppl9705: 68.7,
        suppl9706: 75.3,
        colori: ['Wengé', 'Mogano', 'Teak']
    },
    'gruppo3': {
        desc: 'Gruppo 3',
        suppl9705: 70.3,
        suppl9706: 76.9,
        colori: ['Essenze speciali', 'RAL su legno']
    }
};

// 🆕 v5.67: BANCALI INTERNI (da listino Finstral 10/2025 pag. 56-57)
const FINSTRAL_BANCALI_INTERNI = {
    // Bancale PVC (MDF rivestito pellicola PVC) - codice 25000
    'PVC': {
        codice: '25000',
        desc: 'Bancale MDF pellicolato PVC 25mm',
        spessore: 25,
        note: 'Bordi: 0=arrotondati, 1=squadrati',
        lunghezzaMin: 150,
        lunghezzaMax: 4400,
        profonditaMin: 80,
        profonditaMax: 400,
        // Prezzi per profondità (righe) x lunghezza (colonne)
        // Lunghezze: 600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000, 3200, 3400, 3600, 3800, 4000, 4200, 4400
        lunghezze: [600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000, 3200, 3400, 3600, 3800, 4000, 4200, 4400],
        prezzi: {
            120: [47.6, 51.6, 55.7, 64.3, 70.5, 74.2, 83.3, 87.1, 90.0, 130, 134, 136, 139, 145, 152, 165, 169, 171, 177, 181],
            150: [50.5, 55.7, 60.3, 73.0, 76.8, 82.1, 91.3, 96.4, 100, 141, 146, 150, 155, 161, 171, 184, 188, 191, 196, 203],
            180: [53.2, 58.5, 65.1, 78.2, 83.3, 88.7, 100, 107, 112, 151, 158, 165, 171, 179, 189, 201, 209, 213, 218, 223],
            200: [55.7, 61.4, 70.5, 82.1, 88.7, 93.7, 107, 113, 120, 162, 167, 175, 183, 188, 201, 213, 219, 224, 232, 238],
            240: [60.3, 67.8, 76.8, 90.0, 96.4, 105, 120, 125, 134, 179, 186, 193, 202, 211, 222, 236, 245, 253, 261, 268],
            280: [63.0, 74.2, 83.3, 96.4, 107, 115, 130, 138, 147, 193, 203, 213, 221, 231, 246, 261, 269, 279, 287, 298],
            320: [67.8, 79.6, 88.7, 105, 116, 125, 141, 150, 164, 211, 221, 232, 242, 252, 268, 285, 294, 306, 316, 325],
            360: [73.0, 83.3, 95.2, 113, 124, 136, 151, 166, 179, 225, 237, 250, 263, 273, 290, 308, 319, 333, 345, 356],
            400: [76.8, 88.7, 102, 122, 134, 146, 166, 181, 192, 242, 256, 268, 281, 294, 312, 333, 347, 359, 373, 387]
        }
    },
    // Bancale Legno 19mm profilo 39mm - codice 95000
    'LEGNO_95000': {
        codice: '95000',
        desc: 'Bancale Legno 19mm (profilo 39mm)',
        spessore: 19,
        profiloAlt: 39,
        note: 'Bordi: 0=arrotondati, 1=squadrati. Gruppi colore legno 1+2+3+4 stesso prezzo',
        lunghezzaMin: 150,
        lunghezzaMax: 3200,
        profonditaMin: 70,
        profonditaMax: 400,
        lunghezze: [600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000, 3200],
        prezzi: {
            120: [104, 120, 136, 152, 170, 186, 202, 217, 233, 250, 266, 283, 299, 315],
            150: [112, 130, 149, 169, 188, 205, 223, 243, 263, 281, 299, 318, 336, 355],
            180: [119, 139, 162, 184, 204, 224, 246, 267, 290, 309, 329, 350, 374, 395],
            200: [123, 147, 170, 193, 215, 237, 263, 285, 307, 328, 350, 376, 398, 419],
            240: [134, 161, 188, 212, 237, 265, 291, 317, 343, 370, 395, 419, 445, 473],
            280: [145, 174, 203, 232, 263, 291, 320, 348, 379, 408, 439, 467, 497, 525],
            320: [152, 188, 218, 251, 286, 318, 348, 384, 415, 446, 481, 513, 546, 578],
            360: [165, 199, 235, 271, 308, 344, 379, 415, 452, 488, 522, 557, 597, 631],
            400: [174, 213, 251, 292, 329, 371, 410, 446, 488, 527, 565, 606, 645, 683]
        }
    },
    // Bancale Legno 19mm profilo 69mm - codice 96000
    'LEGNO_96000': {
        codice: '96000',
        desc: 'Bancale Legno 19mm (profilo 69mm)',
        spessore: 19,
        profiloAlt: 69,
        note: 'Bordi: 0=arrotondati, 1=squadrati. Gruppi colore legno 1+2+3+4 stesso prezzo',
        lunghezzaMin: 150,
        lunghezzaMax: 4400,
        profonditaMin: 70,
        profonditaMax: 400,
        lunghezze: [600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000, 3200, 3400, 3600, 3800, 4000, 4200, 4400],
        prezzi: {
            // Stesso prezzo di 95000 fino a 3200, poi continua
            120: [104, 120, 136, 152, 170, 186, 202, 217, 233, 250, 266, 283, 299, 315, 330, 347, 362, 379, 397, 413],
            150: [112, 130, 149, 169, 188, 205, 223, 243, 263, 281, 299, 318, 336, 355, 374, 392, 412, 427, 446, 466],
            180: [119, 139, 162, 184, 204, 224, 246, 267, 290, 309, 329, 350, 374, 395, 415, 437, 456, 479, 500, 520],
            200: [123, 147, 170, 193, 215, 237, 263, 285, 307, 328, 350, 376, 398, 419, 442, 466, 490, 511, 534, 556],
            240: [134, 161, 188, 212, 237, 265, 291, 317, 343, 370, 395, 419, 445, 473, 499, 523, 550, 577, 604, 629],
            280: [145, 174, 203, 232, 263, 291, 320, 348, 379, 408, 439, 467, 497, 525, 553, 585, 613, 644, 672, 702],
            320: [152, 188, 218, 251, 286, 318, 348, 384, 415, 446, 481, 513, 546, 578, 611, 644, 675, 709, 741, 774],
            360: [165, 199, 235, 271, 308, 344, 379, 415, 452, 488, 522, 557, 597, 631, 666, 704, 737, 775, 810, 845],
            400: [174, 213, 251, 292, 329, 371, 410, 446, 488, 527, 565, 606, 645, 683, 723, 762, 802, 840, 880, 920]
        }
    }
};

// Funzione calcolo prezzo bancale interno
function calcolaPrezzoBancaleInterno(tipo, lunghezza, profondita) {
    const bancale = FINSTRAL_BANCALI_INTERNI[tipo];
    if (!bancale) return 0;
    
    // Trova indice lunghezza (arrotonda per eccesso)
    let idxL = 0;
    for (let i = 0; i < bancale.lunghezze.length; i++) {
        if (lunghezza <= bancale.lunghezze[i]) { idxL = i; break; }
        idxL = i;
    }
    
    // Trova riga profondità (arrotonda per eccesso)
    const profDisp = Object.keys(bancale.prezzi).map(Number).sort((a,b) => a-b);
    let rigaP = profDisp[0];
    for (const p of profDisp) {
        if (profondita <= p) { rigaP = p; break; }
        rigaP = p;
    }
    
    return bancale.prezzi[rigaP]?.[idxL] || 0;
}

// 🆕 v5.67: PROFILI ALLARGAMENTO (da listino Finstral 10/2025 pag. 64-82)
const FINSTRAL_ALLARGAMENTI = {
    // Allargamento PVC-PVC profondità 77mm (cod. 1Q1 senza rinforzo, 1QX1 con rinforzo)
    'PVC_77': {
        codSenzaRinforzo: '1Q1',
        codConRinforzo: '1QX1',
        desc: 'Allargamento 77mm PVC-PVC',
        telai: ['961', '962', '963', '924', '991', '951'],
        misure: {
            30:  { senzaRinf: [19.1, 21.2], conRinf: [25.9, 28.1], raggio: 400 },
            50:  { senzaRinf: [21.5, 22.9], conRinf: [28.3, 29.8], raggio: 450 },
            80:  { senzaRinf: [45.6, 49.2], conRinf: null },
            100: { senzaRinf: [45.6, 49.2], conRinf: null },
            150: { senzaRinf: [45.6, 49.2], conRinf: null },
            200: { senzaRinf: [67.1, 75.0], conRinf: null },
            250: { senzaRinf: [91.2, 101], conRinf: null },
            300: { senzaRinf: [91.2, 101], conRinf: null }
        },
        note: 'Oltre 150mm = 2 pezzi assemblati. Supplemento arco: +72.6€'
    },
    // Allargamento PVC-PVC profondità 60mm (cod. 1P1)
    'PVC_60': {
        codSenzaRinforzo: '1P1',
        desc: 'Allargamento 60mm PVC-PVC',
        telai: ['965', '966'],
        misure: {
            30:  { senzaRinf: [14.8, 16.5], raggio: 400 },
            50:  { senzaRinf: [17.1, 19.7], raggio: 450 },
            60:  { senzaRinf: [29.6, 33.1] },
            80:  { senzaRinf: [31.9, 36.2] },
            90:  { senzaRinf: [44.3, 49.6] },
            100: { senzaRinf: [34.1, 39.3] },
            110: { senzaRinf: [46.6, 52.8] },
            120: { senzaRinf: [59.1, 66.2] },
            130: { senzaRinf: [48.9, 55.9] },
            140: { senzaRinf: [61.4, 69.3] },
            150: { senzaRinf: [51.2, 59.0] },
            160: { senzaRinf: [63.7, 72.4] },
            170: { senzaRinf: [76.2, 85.8] },
            180: { senzaRinf: [66.0, 75.5] },
            200: { senzaRinf: [68.3, 78.7] },
            210: { senzaRinf: [80.7, 92.1] },
            240: { senzaRinf: [95.5, 109] },
            250: { senzaRinf: [85.3, 98.3] },
            280: { senzaRinf: [106, 115] },
            300: { senzaRinf: [102, 118] }
        }
    },
    // 🆕 Allargamento PVC-LEGNO profondità 77mm (cod. 4GAC) - NUOVO listino 10/2025
    'PVC_LEGNO_77': {
        codice: '4GAC',
        desc: 'Allargamento 77mm PVC-Legno',
        note: 'Prezzi variano per gruppo colore PVC (A/B) e gruppo colore legno (1/2/3/4)',
        misure: {
            // [gruppoA_legno1, gruppoA_legno2, gruppoA_legno3, gruppoA_legno4, gruppoB_legno1, gruppoB_legno2, gruppoB_legno3, gruppoB_legno4]
            30:  [65.2, 65.2, 65.2, 79.3, 66.9, 83.3, 88.3, 81.0],
            50:  [70.3, 89.4, 94.4, 86.7, 72.9, 92.0, 97.1, 89.3],
            80:  [135, 171, 181, 166, 140, 175, 185, 170],
            100: [141, 179, 189, 173, 146, 184, 194, 179],
            150: [211, 268, 283, 260, 219, 276, 291, 268]
        }
    },
    // Allargamento PVC-ALU profondità 77mm (cod. 2GAC)
    'PVC_ALU_77': {
        codice: '2GAC',
        desc: 'Allargamento 77mm PVC-Alluminio',
        note: 'Prezzi variano per gruppo colore PVC (A/B)',
        misure: {
            // [gruppoA, gruppoB] per gruppo colore ALU standard
            30:  { gruppoA: [60.4, 65.2], gruppoB: [62.1, 66.9] },
            50:  { gruppoA: [66.2, 72.9], gruppoB: [68.9, 75.6] },
            80:  { gruppoA: [109, 117], gruppoB: [114, 122] },
            100: { gruppoA: [115, 125], gruppoB: [121, 130] },
            150: { gruppoA: [164, 177], gruppoB: [172, 185] }
        }
    },
    // 🆕 Allargamento ALU-LEGNO profondità 85mm (nuovo listino 10/2025)
    'ALU_LEGNO_85': {
        codice: 'AGAC85',
        desc: 'Allargamento 85mm Alluminio-Legno',
        note: 'Prezzi per gruppo colore ALU e legno',
        misure: {
            // Valori da tabella pag. 75
            30: { base: 75.0 },
            50: { base: 82.5 },
            80: { base: 140 },
            100: { base: 150 }
        }
    }
};

// Funzione calcolo prezzo allargamento
function calcolaPrezzoAllargamento(tipo, misura, gruppoColoreInt, gruppoColoreEst, conRinforzo = false) {
    const allar = FINSTRAL_ALLARGAMENTI[tipo];
    if (!allar || !allar.misure[misura]) return 0;
    
    const datiMisura = allar.misure[misura];
    
    if (tipo === 'PVC_77') {
        if (conRinforzo && datiMisura.conRinf) {
            return datiMisura.conRinf[0]; // Primo valore (telaio 77)
        }
        return datiMisura.senzaRinf[0];
    } else if (tipo === 'PVC_60') {
        return datiMisura.senzaRinf[0];
    } else if (tipo === 'PVC_LEGNO_77') {
        // Array: [A-L1, A-L2, A-L3, A-L4, B-L1, B-L2, B-L3, B-L4]
        const gruppoInt = gruppoColoreInt?.startsWith('gruppoA') ? 0 : 4;
        const gruppoLegno = parseInt(gruppoColoreEst?.replace('gruppo', '') || '1') - 1;
        return datiMisura[gruppoInt + gruppoLegno] || 0;
    } else if (tipo === 'PVC_ALU_77') {
        const gruppo = gruppoColoreInt?.startsWith('gruppoA') ? 'gruppoA' : 'gruppoB';
        return datiMisura[gruppo]?.[0] || 0;
    }
    
    return 0;
}

// 🆕 v5.67: ANTA TWIN - VENEZIANA E TENDA PLISSETTATA (da listino Finstral 10/2025 pag. 146-147)
const FINSTRAL_ANTA_TWIN = {
    // Tipi anta Twin disponibili
    tipiAnta: {
        'SLIM_TWIN': { cod: 'C788', desc: 'Slim-line Twin 77mm', codVeneziana: 'WS25' },
        'SLIM_TWIN_90': { cod: 'C988', desc: 'Slim-line Twin 90/124mm', codVeneziana: 'WS25' },
        'SLIM_CRISTAL_TWIN': { cod: 'C779', desc: 'Slim-line Cristal Twin', codVeneziana: 'WSC25' },
        'SLIM_CRISTAL_TWIN_90': { cod: 'C979', desc: 'Slim-line Cristal Twin 90/124', codVeneziana: 'WSC25' },
        'NOVA_TWIN': { cod: 'N989', desc: 'Nova-line Twin', codVeneziana: 'WN25' },
        'NOVA_CRISTAL_TWIN': { cod: 'N979', desc: 'Nova-line Cristal Twin', codVeneziana: 'WNC25' }
    },
    
    // Colori veneziana disponibili
    coloriVeneziana: {
        '0717': { desc: 'Argento', gtot: 0.09, classe: 4 },
        '9007': { desc: 'Argento scuro', gtot: 0.13, classe: 3 },
        '0617': { desc: 'Grigio (RAL 7042)', gtot: 0.13, classe: 3 },
        '0611': { desc: 'Grigio chiaro (RAL 9018)', gtot: 0.11, classe: 3 },
        '0610': { desc: 'Bianco', gtot: 0.10, classe: 3 },
        '0609': { desc: 'Bianco traffico (RAL 9016)', gtot: 0.09, classe: 4 },
        '0825': { desc: 'Bianco crema', gtot: 0.19, classe: 2 },
        '0522': { desc: 'Beige grigio', gtot: 0.12, classe: 3 },
        '0620': { desc: 'Beige chiaro', gtot: 0.11, classe: 3 }
    },
    
    // Colori tenda plissettata
    coloriPlissettata: {
        '7460': { esterno: 'Grigio chiaro', interno: 'Bianco grigiastro', riflessione: 70, trasmissione: 0, assorbimento: 30 },
        '7461': { esterno: 'Grigio chiaro', interno: 'Beige chiaro', riflessione: 70, trasmissione: 0, assorbimento: 30 },
        '7464': { esterno: 'Grigio chiaro', interno: 'Beige', riflessione: 70, trasmissione: 0, assorbimento: 30 },
        '7467': { esterno: 'Grigio chiaro', interno: 'Beige grigio', riflessione: 70, trasmissione: 0, assorbimento: 30 }
    },
    
    // Comandi disponibili
    comandi: {
        '27': { desc: 'Catenella (standard)', suppl: 0, note: 'Incluso nel prezzo' },
        '30': { desc: 'Motore (cavo 2,5m)', suppl: 345, note: '24V DC, 15.6W' },
        '30-1': { desc: 'Motore (cavo 10m)', suppl: 356, note: '24V DC, 15.6W' }
    },
    
    // Tabella prezzi VENEZIANA (L x A)
    // Lunghezze: 615, 740, 865, 990, 1115, 1240, 1365, 1490
    prezziVeneziana: {
        lunghezze: [615, 740, 865, 990, 1115, 1240, 1365, 1490],
        prezzi: {
            605:  [133, 135, 137, 149, 163, 166, 170, 174],
            730:  [136, 139, 142, 157, 169, 172, 176, 180],
            855:  [139, 145, 148, 163, 175, 179, 183, 185],
            980:  [142, 146, 150, 166, 181, 185, 188, 191],
            1105: [145, 148, 152, 170, 186, 190, 193, 197],
            1230: [150, 155, 161, 176, 192, 198, 205, 211],
            1355: [158, 163, 166, 183, 198, 208, 217, 226],
            1480: [163, 167, 172, 192, 211, 218, 224, 232],
            1605: [166, 172, 180, 202, 224, 228, 232, 236],
            1730: [169, 175, 181, 204, 226, 233, 240, 246],
            1855: [170, 176, 183, 205, 228, 238, 248, 258],
            1980: [176, 185, 193, 215, 237, 246, 255, 265],
            2105: [183, 193, 204, 225, 246, 253, 264, 272],
            2230: [189, 202, 206, 228, 250, 261, 271, 282],
            2355: [196, 210, 210, 232, 255, 267, 279, 291],
            2480: [0, 219, 213, 237, 261, 274, 287, 300],
            2605: [0, 0, 217, 240, 265, 281, 295, 310],
            2730: [0, 0, 224, 249, 274, 293, 312, 330]
        },
        // Larghezze minime anta per altezza
        larghezzaMinAltezza: { 2113: 389, 2114: 469 }, // fino a 2113mm = 389mm min, oltre = 469mm min
        larghezzaMinMotore: { 2113: 504, 2114: 584 }   // con motore
    },
    
    // Tabella prezzi TENDA PLISSETTATA (L x A)
    prezziPlissettata: {
        lunghezze: [615, 740, 865, 990, 1115, 1240, 1365, 1490],
        prezzi: {
            605:  [283, 323, 344, 358, 381, 392, 408, 423],
            730:  [286, 325, 345, 361, 386, 395, 411, 425],
            855:  [300, 345, 359, 379, 402, 411, 426, 443],
            980:  [330, 374, 392, 412, 434, 445, 465, 482],
            1105: [347, 391, 408, 427, 451, 465, 483, 503],
            1230: [366, 411, 428, 451, 479, 490, 509, 527],
            1355: [384, 427, 445, 472, 497, 509, 527, 547],
            1480: [412, 457, 481, 505, 530, 541, 561, 580],
            1605: [426, 476, 497, 520, 547, 560, 580, 602],
            1730: [446, 495, 514, 541, 567, 583, 602, 618],
            1855: [467, 510, 533, 557, 585, 604, 618, 633],
            1980: [494, 540, 562, 593, 621, 638, 651, 665],
            2105: [509, 556, 579, 611, 640, 653, 667, 682],
            2230: [550, 578, 604, 633, 659, 683, 697, 709],
            2355: [593, 595, 619, 648, 680, 708, 722, 735],
            2480: [0, 625, 648, 683, 699, 732, 745, 758],
            2605: [0, 640, 666, 700, 717, 757, 768, 782],
            2730: [0, 656, 685, 714, 735, 779, 794, 806]
        },
        larghezzaMinAltezza: { 2113: 434, 2114: 469 },
        larghezzaMinMotore: { 2113: 504, 2114: 584 }
    }
};

// Funzione calcolo prezzo veneziana/plissettata
function calcolaPrezzoAntaTwin(tipo, larghezza, altezza, comando = '27') {
    const tabella = tipo === 'veneziana' ? FINSTRAL_ANTA_TWIN.prezziVeneziana : FINSTRAL_ANTA_TWIN.prezziPlissettata;
    if (!tabella) return 0;
    
    // Trova indice larghezza
    let idxL = 0;
    for (let i = 0; i < tabella.lunghezze.length; i++) {
        if (larghezza <= tabella.lunghezze[i]) { idxL = i; break; }
        idxL = i;
    }
    
    // Trova riga altezza
    const altDisp = Object.keys(tabella.prezzi).map(Number).sort((a,b) => a-b);
    let rigaA = altDisp[0];
    for (const a of altDisp) {
        if (altezza <= a) { rigaA = a; break; }
        rigaA = a;
    }
    
    let prezzo = tabella.prezzi[rigaA]?.[idxL] || 0;
    
    // Aggiungi supplemento comando motore
    const comandoData = FINSTRAL_ANTA_TWIN.comandi[comando];
    if (comandoData) {
        prezzo += comandoData.suppl;
    }
    
    return prezzo;
}

// 🆕 v5.23: TELAI ORGANIZZATI PER COMBINAZIONE MATERIALI
const FINDOOR_TELAI_PER_COMB = {
    'PVC-PVC': {
        'L': {  // Forma L - Apertura interna
            '961': { desc: 'PVC-PVC 77mm (standard)', spessore: 77, supplPvc: 0, supplAlu: 5.20 },
            '962': { desc: 'PVC-PVC 90mm', spessore: 90, supplPvc: 0, supplAlu: 5.61 },
            '963': { desc: 'PVC-PVC 124mm', spessore: 124, supplPvc: 2.89, supplAlu: 9.31 },
            '924': { desc: 'PVC-PVC 90mm var.', spessore: 90, supplPvc: 8.83, supplAlu: 14.30 },
            '991': { desc: 'PVC-PVC 90mm Z', spessore: 90, supplPvc: 10.90, supplAlu: 16.50 },
            '951': { desc: 'PVC-PVC 124mm var.', spessore: 124, supplPvc: 13.00, supplAlu: 20.10 }
        },
        'Z': {  // Forma Z
            'Z62': { desc: 'PVC-PVC 67mm', spessore: 67, supplPvc: 5.21, supplAlu: 10.40 },
            '967': { desc: 'PVC-PVC 77mm', spessore: 77, supplPvc: 10.90, supplAlu: 15.30 },
            'Z91': { desc: 'PVC-PVC 90mm', spessore: 90, supplPvc: 16.10, supplAlu: 21.70 }
        },
        'T': {  // Forma T
            'AZ63': { desc: 'PVC-PVC 77mm', spessore: 77, supplPvc: 5.07, supplAlu: 11.50 }
        }
    },
    'PVC-ALU': {
        'L': {  // Con rivestimento ALU esterno
            'A961': { desc: 'PVC int./ALU est. 77mm', spessore: 77, supplPvc: 0, supplAlu: 5.20 },
            'A962': { desc: 'PVC int./ALU est. 90mm', spessore: 90, supplPvc: 0, supplAlu: 5.61 },
            'A963': { desc: 'PVC int./ALU est. 124mm', spessore: 124, supplPvc: 2.89, supplAlu: 9.31 }
        },
        'Z': {  // Forma Z con ALU esterno
            'AZ62': { desc: 'PVC int./ALU est. Z 67mm', spessore: 67, supplPvc: 5.21, supplAlu: 10.40 },
            'A967': { desc: 'PVC int./ALU est. Z 77mm', spessore: 77, supplPvc: 10.90, supplAlu: 15.30 },
            'AZ91': { desc: 'PVC int./ALU est. Z 90mm', spessore: 90, supplPvc: 16.10, supplAlu: 21.70 }
        }
    },
    'LEGNO-ALU': {
        'L': {  // Legno interno, ALU esterno
            '9705': { desc: 'Legno int./ALU est. 78mm', spessore: 78, supplAlu: 24.20, note: 'Cod. base 705 + legno' },
            '9706': { desc: 'Legno int./ALU est. 84mm', spessore: 84, supplAlu: 32.40, note: 'Cod. base 706 + legno' }
        }
    },
    'ALU-ALU': {
        'L': {  // Forma L - Apertura interna
            '705': { desc: 'ALU-ALU 78mm', spessore: 78, supplAlu: 24.20, note: 'Cerniere a scomparsa' },
            '706': { desc: 'ALU-ALU 84mm', spessore: 84, supplAlu: 32.40 },
            '711': { desc: 'ALU-ALU 102mm', spessore: 102, supplAlu: 35.00 },
            '718': { desc: 'ALU-ALU 87mm T', spessore: 87, supplAlu: 32.40 },
            '720': { desc: 'ALU-ALU 90mm', spessore: 90, supplAlu: 24.20, note: 'Solo cerniere cod.220' }
        },
        'L-EST': {  // Forma L - Apertura esterna
            'A705': { desc: 'ALU-ALU 78mm (est.)', spessore: 78, supplAlu: 24.20 },
            'A706': { desc: 'ALU-ALU 84mm (est.)', spessore: 84, supplAlu: 32.40 }
        },
        'Z': {
            '707': { desc: 'ALU-ALU 75mm', spessore: 75, supplAlu: 36.40 }
        },
        'T': {
            '718T': { desc: 'ALU-ALU 87mm', spessore: 87, supplAlu: 32.40 }
        }
    },
    // 🆕 v5.66: NUOVE COMBINAZIONI DA LISTINO FINSTRAL 10/2025
    'ALU-PVC': {
        'L': {  // Alluminio interno, PVC esterno
            '961N': { desc: 'ALU int./PVC est. 77mm', spessore: 85, supplPvc: 17.5, supplAlu: 20.9, note: 'Telaio 77+8' },
            '962N': { desc: 'ALU int./PVC est. 90mm', spessore: 98, supplPvc: 17.5, supplAlu: 22.9, note: 'Telaio 90+8' },
            '963N': { desc: 'ALU int./PVC est. 124mm', spessore: 127, supplPvc: 17.5, supplAlu: 22.9, note: 'Telaio 124+3' }
        }
    },
    'ALU-LEGNO': {
        'L': {  // Alluminio interno, Legno esterno (raro ma possibile)
            '9A861': { desc: 'ALU int./Legno est. 77mm', spessore: 85, supplAlu: 22.3, gruppiLegno: true },
            '9D861': { desc: 'ALU int./Legno est. 77mm profondo', spessore: 85, supplAlu: 29.0, gruppiLegno: true }
        }
    },
    'PVC-LEGNO': {
        'L': {  // PVC interno, Legno esterno
            'G861': { desc: 'PVC int./Legno est. 77mm', spessore: 77, supplPvc: 0, gruppiLegno: true },
            'G862': { desc: 'PVC int./Legno est. 90mm', spessore: 90, supplPvc: 2.86, gruppiLegno: true }
        }
    },
    'LEGNO-PVC': {
        'L': {  // Legno interno, PVC esterno
            '9G861': { desc: 'Legno int./PVC est. 77mm', spessore: 77, supplPvc: 2.65, gruppiLegno: true },
            '9G862': { desc: 'Legno int./PVC est. 90mm', spessore: 90, supplPvc: 2.86, gruppiLegno: true }
        }
    }
};

// 🆕 v5.23: TIPI ANTA PER COMBINAZIONE MATERIALI
const FINDOOR_ANTE_PER_COMB = {
    'PVC-PVC': [
        { cod: 'FLAT_FRAME-FLAT_FRAME', desc: 'Flat Frame - Flat Frame', tab: 'PVC' },
        { cod: 'FLAT_FRAME-STEP_FRAME', desc: 'Flat Frame - Step Frame', tab: 'PVC' },
        { cod: 'STEP_FRAME-STEP_FRAME', desc: 'Step Frame - Step Frame', tab: 'PVC' }
    ],
    'PVC-ALU': [
        { cod: 'STEP_PLANAR-FLAT_FRAME', desc: 'Step Planar (ALU) - Flat Frame (PVC)', tab: 'ALU' },
        { cod: 'STEP_PLANAR-STEP_FRAME', desc: 'Step Planar (ALU) - Step Frame (PVC)', tab: 'ALU' }
    ],
    'LEGNO-ALU': [
        { cod: 'STEP_PLANAR-LEGNO', desc: 'Step Planar (ALU) - Legno interno', tab: 'ALU' },
        { cod: 'FLAT_PLANAR-LEGNO', desc: 'Flat Planar (ALU) - Legno interno', tab: 'ALU' }
    ],
    'ALU-ALU': [
        { cod: 'FLAT_PLANAR-FLAT_PLANAR', desc: 'Flat Planar - Flat Planar', tab: 'ALU' },
        { cod: 'FLAT_PLANAR-STEP_PLANAR', desc: 'Flat Planar - Step Planar', tab: 'ALU' },
        { cod: 'STEP_PLANAR-STEP_PLANAR', desc: 'Step Planar - Step Planar', tab: 'ALU' }
    ],
    // 🆕 v5.66: NUOVE COMBINAZIONI DA LISTINO FINSTRAL 10/2025
    'ALU-PVC': [
        { cod: 'STEP_PLANAR-FLAT_FRAME', desc: 'Step Planar (ALU) - Flat Frame (PVC)', tab: 'ALU' },
        { cod: 'STEP_PLANAR-STEP_FRAME', desc: 'Step Planar (ALU) - Step Frame (PVC)', tab: 'ALU' }
    ],
    'ALU-LEGNO': [
        { cod: 'STEP_PLANAR-LEGNO', desc: 'Step Planar (ALU) - Legno esterno', tab: 'ALU' },
        { cod: 'FLAT_PLANAR-LEGNO', desc: 'Flat Planar (ALU) - Legno esterno', tab: 'ALU' }
    ],
    'PVC-LEGNO': [
        { cod: 'FLAT_FRAME-LEGNO', desc: 'Flat Frame (PVC) - Legno esterno', tab: 'LEGNO' },
        { cod: 'STEP_FRAME-LEGNO', desc: 'Step Frame (PVC) - Legno esterno', tab: 'LEGNO' }
    ],
    'LEGNO-PVC': [
        { cod: 'LEGNO-FLAT_FRAME', desc: 'Legno interno - Flat Frame (PVC)', tab: 'LEGNO' },
        { cod: 'LEGNO-STEP_FRAME', desc: 'Legno interno - Step Frame (PVC)', tab: 'LEGNO' }
    ]
};

// LEGACY: Manteniamo per retrocompatibilità
const FINDOOR_TELAI = {
    'L-INT': {
        '961': { desc: 'PVC-PVC 77mm', spessore: 77, supplPvc: 0, supplAlu: 5.20 },
        '962': { desc: 'PVC-PVC 90mm', spessore: 90, supplPvc: 0, supplAlu: 5.61 },
        '963': { desc: 'PVC-PVC 124mm', spessore: 124, supplPvc: 2.89, supplAlu: 9.31 },
        '924': { desc: 'PVC-PVC 90mm', spessore: 90, supplPvc: 8.83, supplAlu: 14.30 },
        '991': { desc: 'PVC-PVC 90mm Z', spessore: 90, supplPvc: 10.90, supplAlu: 16.50 },
        '951': { desc: 'PVC-PVC 124mm', spessore: 124, supplPvc: 13.00, supplAlu: 20.10 },
        '705': { desc: 'ALU-ALU 78mm', spessore: 78, supplAlu: 24.20, note: 'Cerniere a scomparsa' },
        '706': { desc: 'ALU-ALU 84mm', spessore: 84, supplAlu: 32.40 },
        '711': { desc: 'ALU-ALU 102mm', spessore: 102, supplAlu: 35.00 },
        '718': { desc: 'ALU-ALU 87mm T', spessore: 87, supplAlu: 32.40 },
        '720': { desc: 'ALU-ALU 90mm', spessore: 90, supplAlu: 24.20, note: 'Solo cerniere cod.220' }
    },
    'L-EST': {
        'A961': { desc: 'PVC-PVC 77mm', spessore: 77, supplPvc: 0, supplAlu: 5.20 },
        'A962': { desc: 'PVC-PVC 90mm', spessore: 90, supplPvc: 0, supplAlu: 5.61 },
        'A705': { desc: 'ALU-ALU 78mm', spessore: 78, supplAlu: 24.20 },
        'A706': { desc: 'ALU-ALU 84mm', spessore: 84, supplAlu: 32.40 }
    },
    'Z': {
        'Z62': { desc: 'PVC-PVC 67mm', spessore: 67, supplPvc: 5.21, supplAlu: 10.40 },
        '967': { desc: 'PVC-PVC 77mm', spessore: 77, supplPvc: 10.90, supplAlu: 15.30 },
        'Z91': { desc: 'PVC-PVC 90mm', spessore: 90, supplPvc: 16.10, supplAlu: 21.70 },
        '707': { desc: 'ALU-ALU 75mm', spessore: 75, supplAlu: 36.40 }
    },
    'T': {
        '718T': { desc: 'ALU-ALU 87mm', spessore: 87, supplAlu: 32.40 },
        'AZ63': { desc: 'PVC-PVC 77mm', spessore: 77, supplPvc: 5.07, supplAlu: 11.50 }
    }
};

// TIPI ANTA (Interno - Esterno) - LEGACY
const FINDOOR_TIPI_ANTA = [
    { cod: 'STEP_FRAME-STEP_FRAME', desc: 'Step Frame - Step Frame', mat: 'PVC-PVC', tab: 'PVC' },
    { cod: 'FLAT_FRAME-FLAT_FRAME', desc: 'Flat Frame - Flat Frame', mat: 'PVC-PVC', tab: 'PVC' },
    { cod: 'FLAT_FRAME-STEP_FRAME', desc: 'Flat Frame - Step Frame', mat: 'PVC-PVC', tab: 'PVC' },
    { cod: 'FLAT_PLANAR-FLAT_PLANAR', desc: 'Flat Planar - Flat Planar', mat: 'ALU-ALU', tab: 'ALU' },
    { cod: 'STEP_PLANAR-STEP_PLANAR', desc: 'Step Planar - Step Planar', mat: 'ALU-ALU', tab: 'ALU' },
    { cod: 'FLAT_PLANAR-STEP_PLANAR', desc: 'Flat Planar - Step Planar', mat: 'ALU-ALU', tab: 'ALU' },
    { cod: 'STEP_PLANAR-FLAT_FRAME', desc: 'Step Planar - Flat Frame', mat: 'PVC-ALU', tab: 'ALU' },
    { cod: 'STEP_PLANAR-STEP_FRAME', desc: 'Step Planar - Step Frame', mat: 'PVC-ALU', tab: 'ALU' }
];

// PREZZI BASE TIPO 720 (griglia L×H)
// 🆕 v5.67: PREZZI BASE INFISSI FINSTRAL (da listino 10/2025 pag. 157-159)
// Tipo 101 = Anta singola | Tipo 401 = Con montante mobile
const FINSTRAL_PREZZI_BASE_INFISSI = {
    // Tipo 101 - Anta singola
    'tipo101': {
        desc: 'Anta singola',
        // Larghezze colonne: 615, 740, 865, 990, 1115, 1240, 1365, 1490, 1615
        larghezze: [615, 740, 865, 990, 1115, 1240, 1365, 1490, 1615],
        prezzi: {
            605:  [225, 243, 261, 276, 292, 311, 328, 344, 362],
            730:  [247, 267, 287, 305, 323, 343, 362, 381, 400],
            855:  [270, 292, 314, 334, 354, 376, 397, 418, 440],
            980:  [293, 316, 340, 363, 385, 409, 432, 455, 478],
            1105: [315, 341, 367, 391, 416, 442, 467, 491, 517],
            1230: [338, 366, 393, 420, 447, 475, 501, 529, 556],
            1355: [361, 390, 420, 449, 478, 508, 536, 566, 595],
            1480: [383, 414, 446, 477, 508, 540, 571, 602, 634],
            1605: [406, 439, 473, 506, 539, 573, 606, 640, 673],
            1730: [428, 464, 499, 534, 570, 606, 641, 677, 712],
            1855: [451, 488, 526, 563, 601, 639, 676, 714, 752],
            1980: [473, 513, 552, 592, 631, 672, 711, 751, 791],
            2105: [496, 538, 579, 621, 662, 705, 746, 788, 830],
            2230: [519, 562, 605, 649, 693, 738, 781, 825, 869],
            2355: [541, 586, 632, 678, 724, 770, 815, 862, 908],
            2480: [564, 611, 658, 707, 754, 803, 850, 899, 947],
            2605: [586, 636, 685, 735, 785, 836, 885, 936, 986],
            2730: [609, 660, 712, 764, 816, 869, 920, 973, 1025]
        }
    },
    // Tipo 401 - Con montante mobile
    'tipo401': {
        desc: 'Con montante mobile',
        // Larghezze maggiori per doppia anta
        larghezze: [1115, 1240, 1365, 1490, 1615, 1740, 1865, 1990, 2115, 2240],
        prezzi: {
            605:  [383, 401, 420, 439, 457, 476, 494, 513, 532, 550],
            730:  [424, 444, 465, 485, 506, 527, 547, 568, 589, 609],
            855:  [465, 488, 510, 532, 555, 577, 600, 622, 645, 668],
            980:  [506, 531, 555, 580, 604, 629, 653, 678, 702, 727],
            1105: [547, 574, 600, 627, 653, 680, 706, 733, 760, 786],
            1230: [589, 617, 646, 674, 703, 731, 760, 788, 817, 845],
            1355: [630, 660, 691, 721, 752, 782, 813, 843, 874, 904],
            1480: [671, 704, 736, 769, 801, 834, 866, 899, 931, 964],
            1605: [712, 747, 781, 816, 850, 885, 919, 954, 988, 1023],
            1730: [754, 790, 827, 863, 900, 936, 973, 1009, 1046, 1082],
            1855: [795, 833, 872, 910, 949, 987, 1026, 1064, 1103, 1141],
            1980: [836, 877, 917, 958, 998, 1039, 1079, 1120, 1160, 1201],
            2105: [877, 920, 962, 1005, 1047, 1090, 1132, 1175, 1217, 1260],
            2230: [919, 963, 1008, 1052, 1097, 1141, 1186, 1230, 1275, 1319],
            2355: [960, 1006, 1053, 1099, 1146, 1192, 1239, 1285, 1332, 1378],
            2480: [1001, 1050, 1098, 1147, 1195, 1244, 1292, 1341, 1389, 1438],
            2605: [1042, 1093, 1143, 1194, 1244, 1295, 1345, 1396, 1446, 1497],
            2730: [1084, 1136, 1189, 1241, 1294, 1346, 1399, 1451, 1504, 1556]
        }
    },
    // Tipo 101S - Anta singola scorrevole
    'tipo101S': {
        desc: 'Anta singola scorrevole',
        larghezze: [740, 865, 990, 1115, 1240, 1365, 1490],
        prezzi: {
            1355: [512, 538, 564, 590, 617, 643, 669],
            1480: [544, 572, 600, 628, 656, 684, 712],
            1605: [577, 607, 636, 666, 696, 725, 755],
            1730: [610, 641, 673, 704, 735, 767, 798],
            1855: [642, 676, 709, 743, 776, 810, 843],
            1980: [675, 710, 746, 781, 817, 852, 888],
            2105: [708, 745, 782, 820, 857, 894, 932],
            2230: [740, 780, 819, 858, 897, 937, 976],
            2355: [773, 814, 855, 897, 938, 979, 1020],
            2480: [806, 849, 892, 935, 978, 1021, 1064]
        }
    }
};

// Funzione calcolo prezzo base infisso
function calcolaPrezzoBaseInfisso(tipo, larghezza, altezza) {
    const tabella = FINSTRAL_PREZZI_BASE_INFISSI[tipo];
    if (!tabella) return 0;
    
    // Trova indice larghezza (arrotonda per eccesso)
    let idxL = 0;
    for (let i = 0; i < tabella.larghezze.length; i++) {
        if (larghezza <= tabella.larghezze[i]) { idxL = i; break; }
        idxL = i;
    }
    
    // Trova riga altezza (arrotonda per eccesso)
    const altDisp = Object.keys(tabella.prezzi).map(Number).sort((a,b) => a-b);
    let rigaA = altDisp[0];
    for (const a of altDisp) {
        if (altezza <= a) { rigaA = a; break; }
        rigaA = a;
    }
    
    return tabella.prezzi[rigaA]?.[idxL] || 0;
}

const FINDOOR_PREZZI_BASE = {
    'PVC': {
        larghezze: [990, 1115, 1240, 1365],
        prezzi: {
            2040: [1240, 1297, 1351, 1408],
            2165: [1272, 1329, 1388, 1444],
            2290: [1303, 1362, 1422, 1482],
            2415: [1412, 1474, 1535, 1597],
            2540: [1443, 1507, 1570, 1633],
            2665: [1475, 1540, 1606, 1670],
            2790: [1506, 1573, 1640, 1708],
            2915: [1537, 1607, 1675, 1744]
        }
    },
    'ALU': {
        larghezze: [990, 1115, 1240, 1365, 1490],
        prezzi: {
            2040: [1871, 1944, 2018, 2093, 2165],
            2165: [1922, 1998, 2074, 2149, 2225],
            2290: [1973, 2051, 2129, 2207, 2284],
            2415: [2036, 2117, 2197, 2276, 2355],
            2540: [2087, 2169, 2251, 2333, 2416],
            2665: [2139, 2223, 2307, 2391, 2475],
            2790: [2190, 2276, 2361, 2448, 2534],
            2915: [2241, 2329, 2418, 2506, 2594]
        }
    }
};

// MODELLI ANTA con prezzi supplemento
const FINDOOR_MODELLI_ANTA = {
    '01': { desc: 'Liscio', minL: 460, minH: 1770,
        prezzi: { 'FLAT_PLANAR': [2511, 2651], 'STEP_PLANAR': [2417, 2551], 'STEP_FRAME': [1860, 1860] }
    },
    '02': { desc: 'Fresatura 1mm', minL: 750, minH: 1770,
        prezzi: { 'FLAT_PLANAR': [2529, 2669], 'STEP_PLANAR': [2436, 2569], 'STEP_FRAME': [1878, 1878] }
    },
    '04': { desc: 'Fresatura laterale', minL: 600, minH: 1770, stessoPrezzoDi: '02' },
    '05': { desc: 'Fresatura verticale', minL: 600, minH: 1770, stessoPrezzoDi: '02' },
    '06': { desc: 'Fresatura orizzontale', minL: 600, minH: 1770, stessoPrezzoDi: '02' },
    '07': { desc: 'Fresatura linee', minL: 460, minH: 1770, stessoPrezzoDi: '02' },
    '20': { desc: 'Inserto inox', minL: 460, minH: 1770,
        prezzi: { 'FLAT_PLANAR': [2610, 2750], 'STEP_PLANAR': [2516, 2650], 'STEP_FRAME': [1946, 1946] }
    },
    '21': { desc: 'Inserto inox 2', minL: 460, minH: 1770, stessoPrezzoDi: '20' },
    '23': { desc: 'Inserto inox + fresatura', minL: 600, minH: 1770,
        prezzi: { 'FLAT_PLANAR': [2877, 3017], 'STEP_PLANAR': [2783, 2917], 'STEP_FRAME': [2192, 2192] }
    },
    '24': { desc: 'Inserto inox variante', minL: 460, minH: 1770,
        prezzi: { 'FLAT_PLANAR': [2610, 2750], 'STEP_PLANAR': [2307, 2413], 'STEP_FRAME': [1946, 1946] }
    },
    '41': { desc: 'Inserto vetro', minL: 800, minH: 1770,
        prezzi: { 'FLAT_PLANAR': [3498, 3637], 'STEP_PLANAR': [3403, 3538], 'STEP_FRAME': [2704, 2704] }
    },
    '43': { desc: 'Inserto vetro grande', minL: 880, minH: 1900,
        prezzi: { 'FLAT_PLANAR': [3796, 3936], 'STEP_PLANAR': [3702, 3836], 'STEP_FRAME': [3003, 3003] }
    },
    '44': { desc: 'Vetro laterale', minL: 750, minH: 1770, stessoPrezzoDi: '43' },
    '45': { desc: 'Vetro fascia', minL: 750, minH: 1770, stessoPrezzoDi: '43' },
    '46-1': { desc: 'Vetro doppio v1', minL: 750, minH: 1860,
        prezzi: { 'FLAT_PLANAR': [2899, 3039], 'STEP_PLANAR': [2806, 2939], 'STEP_FRAME': [2204, 2204] }
    },
    '46-2': { desc: 'Vetro doppio v2', minL: 750, minH: 1860,
        prezzi: { 'FLAT_PLANAR': [2667, 2803], 'STEP_PLANAR': [2204, 2204], 'STEP_FRAME': [1991, 1991] }
    },
    '47-1': { desc: 'Vetro triplo v1', minL: 750, minH: 1860, stessoPrezzoDi: '46-1' },
    '47-2': { desc: 'Vetro triplo v2', minL: 750, minH: 1860, stessoPrezzoDi: '46-2' },
    '48': { desc: 'Vetro grande', minL: 880, minH: 1900, stessoPrezzoDi: '43' },
    '49': { desc: 'Vetro panoramico', minL: 880, minH: 1900, stessoPrezzoDi: '43' },
    '50-1': { desc: 'Vetro + fresatura v1', minL: 750, minH: 1770, stessoPrezzoDi: '46-1' },
    '50-2': { desc: 'Vetro + fresatura v2', minL: 750, minH: 1770, stessoPrezzoDi: '46-2' },
    '51': { desc: 'Vetro ovale', minL: 750, minH: 1770, stessoPrezzoDi: '43' },
    '52': { desc: 'Vetro quadrato', minL: 750, minH: 1770, stessoPrezzoDi: '43' },
    '54': { desc: 'Vetro rettangolare', minL: 750, minH: 1770, stessoPrezzoDi: '43' },
    '58': { desc: 'Vetro design', minL: 750, minH: 1770, stessoPrezzoDi: '43' }
};

// TAGLI TELAIO FIN-DOOR (€/ml)
const FINDOOR_TAGLI_PREZZI = {
    '127': 2.19, '107': 2.19, '163': 2.19, '162': 2.19, '161': 2.19,
    '164': 2.75, '165': 2.75, '166': 2.19, '167': 2.75, '118': 5.22,
    '116': 2.75, '129': 2.75, '132': 2.75, '153': 2.75, '172': 5.22,
    '151': 2.19, '156': 2.19, '157': 2.19, '119': 2.19, '124': 2.19,
    '128': 2.19, '110': 2.19, '318': 5.36, '319': 5.36,
    '179N': 2.19, '179X': 2.19, '5N': 2.19
};

// TAGLI per telaio FIN-DOOR
const FINDOOR_TAGLI_PER_TELAIO = {
    '961': ['127', '107', '163', '162', '164', '165', '179N'],
    '962': ['127', '107', '161', '118', '163', '164', '165', '116', '167', '129', '132', '153', '179N', '172', '162', '166'],
    '963': ['127', '107', '161', '162', '163', '164', '165', '105', '166', '170', '118', '134', '149', '172', '116', '129', '132', '167', '147', '148', '179N'],
    '705': ['318'], '706': ['318'], '711': ['318'], '718': ['318'], '720': ['318'],
    '707': ['318'], '967': ['128', '110', '115', '100', '120', '125', '130', '140', '179X', '179N'],
    'Z62': ['128', '110', '179N'], 'Z91': ['128', '110', '179N']
};

// 🆕 v5.742: LISTA COMPLETA TELAI FIN-WINDOW (listino EUR 2025/10 pag.11-24)
const FINWINDOW_TELAI_OPTIONS = [
    // === TELAIO 77mm (apertura interna) ===
    '961 - PVC-PVC 77mm (base)',
    '961N - ALU-PVC 77mm',
    '961N5 - ALU-PVC 77mm profilo sottile',
    '961X - ALU-PVC 77mm (solo lat/sup)',
    'F961 - PVC 77mm soglia ribassata',
    // === TELAIO 77mm con rivestimento esterno ===
    '861 - PVC-PVC 77mm (est.)',
    '861N - ALU-PVC 77mm (est.)',
    '861N5 - ALU-PVC 77mm prof.sottile (est.)',
    '861X - ALU-PVC 77mm (est. lat/sup)',
    'A861 - ALU interno 77mm',
    'D861 - ALU interno profondo 77mm',
    'H861 - ALU interno sottile 77mm',
    'F861 - PVC 77mm soglia ribassata (est.)',
    // === TELAIO 77mm con legno ===
    'G861 - PVC-LEGNO 77mm',
    '9G861 - LEGNO-PVC 77mm',
    '9A861 - ALU-LEGNO 77mm',
    '9D861 - ALU-LEGNO profondo 77mm',
    '9H861 - ALU-LEGNO sottile 77mm',
    // === TELAIO 90mm ===
    '962 - PVC-PVC 90mm',
    '962N - ALU-PVC 90mm',
    '962N5 - ALU-PVC 90mm prof.sottile',
    '962X - ALU-PVC 90mm (solo lat/sup)',
    'F962 - PVC 90mm soglia ribassata',
    '862 - PVC-PVC 90mm (est.)',
    '862N - ALU-PVC 90mm (est.)',
    'G862 - PVC-LEGNO 90mm',
    '9G862 - LEGNO-PVC 90mm',
    // === TELAIO 124mm ===
    '963 - PVC-PVC 124mm',
    '963N - ALU-PVC 124mm',
    '963N5 - ALU-PVC 124mm prof.sottile',
    // === TELAIO 90mm SPECIALE (924) ===
    '924 - PVC-PVC 90mm spec.',
    '924N - ALU-PVC 90mm spec.',
    '924N5 - ALU-PVC 90mm spec. prof.sottile',
    '924K - PVC con listello 90mm',
    '924K5 - ALU con listello 90mm',
    // === TELAIO Z (991) ===
    '991 - PVC-PVC 90mm Z',
    '991N - ALU-PVC 90mm Z',
    '991K - PVC con listello Z',
    '991K5 - ALU con listello Z',
    // === TELAIO 951 (Z speciale) ===
    '951 - PVC-PVC 90mm (Z spec.)',
    '951K - PVC con listello (Z spec.)',
    '951K5 - ALU con listello (Z spec.)',
    '951L - PVC con listello largo',
    // === TELAIO 965/966/967 (Step-line) ===
    '965 - PVC-PVC Step-line',
    '965N - ALU-PVC Step-line',
    '965N5 - ALU-PVC Step-line prof.sottile',
    '965M - ALU-PVC Step-line medio',
    '965X - ALU-PVC Step-line (solo lat/sup)',
    '966 - PVC-PVC Step-line (est.)',
    '966N - ALU-PVC Step-line (est.)',
    '966N5 - ALU-PVC Step-line prof.sottile (est.)',
    '966M - ALU-PVC Step-line medio (est.)',
    '967 - PVC-PVC Step-line Door',
    // === TELAIO 129 (Nova-line) ===
    '129 - PVC-PVC Nova-line Plus',
    // === TELAIO Z62/Z91 (speciali) ===
    'Z62 - PVC-PVC Forma a Z 77mm',
    'Z91 - PVC-PVC Forma a Z 90mm',
    'AZ62 - ALU-PVC Forma a Z 77mm',
    'AZ63 - ALU-PVC Forma a Z 90mm'
];

// 🆕 v5.743: TELAI FILTRATI PER MATERIALE
const FINWINDOW_TELAI_PER_MATERIALE = {
    'PVC': [
        '961 - PVC-PVC 77mm (base)',
        'F961 - PVC 77mm soglia ribassata',
        '861 - PVC-PVC 77mm (est.)',
        'F861 - PVC 77mm soglia ribassata (est.)',
        '962 - PVC-PVC 90mm',
        'F962 - PVC 90mm soglia ribassata',
        '862 - PVC-PVC 90mm (est.)',
        '963 - PVC-PVC 124mm',
        '924 - PVC-PVC 90mm spec.',
        '924K - PVC con listello 90mm',
        '991 - PVC-PVC 90mm Z',
        '991K - PVC con listello Z',
        '951 - PVC-PVC 90mm (Z spec.)',
        '951K - PVC con listello (Z spec.)',
        '951L - PVC con listello largo',
        '965 - PVC-PVC Step-line',
        '966 - PVC-PVC Step-line (est.)',
        '967 - PVC-PVC Step-line Door',
        '129 - PVC-PVC Nova-line Plus',
        'Z62 - PVC-PVC Forma a Z 77mm',
        'Z91 - PVC-PVC Forma a Z 90mm'
    ],
    'PVC-ALU': [
        '961N - ALU-PVC 77mm',
        '961N5 - ALU-PVC 77mm profilo sottile',
        '961X - ALU-PVC 77mm (solo lat/sup)',
        '861N - ALU-PVC 77mm (est.)',
        '861N5 - ALU-PVC 77mm prof.sottile (est.)',
        '861X - ALU-PVC 77mm (est. lat/sup)',
        '962N - ALU-PVC 90mm',
        '962N5 - ALU-PVC 90mm prof.sottile',
        '962X - ALU-PVC 90mm (solo lat/sup)',
        '862N - ALU-PVC 90mm (est.)',
        '963N - ALU-PVC 124mm',
        '963N5 - ALU-PVC 124mm prof.sottile',
        '924N - ALU-PVC 90mm spec.',
        '924N5 - ALU-PVC 90mm spec. prof.sottile',
        '924K5 - ALU con listello 90mm',
        '991N - ALU-PVC 90mm Z',
        '991K5 - ALU con listello Z',
        '951K5 - ALU con listello (Z spec.)',
        '965N - ALU-PVC Step-line',
        '965N5 - ALU-PVC Step-line prof.sottile',
        '965M - ALU-PVC Step-line medio',
        '965X - ALU-PVC Step-line (solo lat/sup)',
        '966N - ALU-PVC Step-line (est.)',
        '966N5 - ALU-PVC Step-line prof.sottile (est.)',
        '966M - ALU-PVC Step-line medio (est.)',
        'AZ62 - ALU-PVC Forma a Z 77mm',
        'AZ63 - ALU-PVC Forma a Z 90mm'
    ],
    'ALU': [
        'A861 - ALU interno 77mm',
        'D861 - ALU interno profondo 77mm',
        'H861 - ALU interno sottile 77mm'
    ],
    'LEGNO': [
        'G861 - PVC-LEGNO 77mm',
        '9G861 - LEGNO-PVC 77mm',
        '9A861 - ALU-LEGNO 77mm',
        '9D861 - ALU-LEGNO profondo 77mm',
        '9H861 - ALU-LEGNO sottile 77mm',
        'G862 - PVC-LEGNO 90mm',
        '9G862 - LEGNO-PVC 90mm'
    ]
};

// 🆕 v5.743: Funzione per ottenere telai filtrati per materiale
function getTelaiPerMateriale(materiale) {
    if (!materiale) return FINWINDOW_TELAI_OPTIONS;
    
    const mat = materiale.toUpperCase();
    if (mat.includes('LEGNO')) return FINWINDOW_TELAI_PER_MATERIALE['LEGNO'];
    if (mat === 'ALU' || mat === 'ALLUMINIO') return FINWINDOW_TELAI_PER_MATERIALE['ALU'];
    if (mat.includes('ALU') || mat.includes('PVC-ALU') || mat.includes('ALU-PVC')) return FINWINDOW_TELAI_PER_MATERIALE['PVC-ALU'];
    if (mat === 'PVC') return FINWINDOW_TELAI_PER_MATERIALE['PVC'];
    
    return FINWINDOW_TELAI_OPTIONS; // Default: tutti
}

// 🆕 v5.743: Determina tipo telaio da finiture INT/EST
function getTipoTelaioDaFinitura(finituraInt, finituraEst) {
    const fInt = (finituraInt || 'pvc').toLowerCase();
    const fEst = (finituraEst || 'pvc').toLowerCase();
    
    // Legno ha priorità
    if (fInt === 'legno' || fEst === 'legno') return 'LEGNO';
    
    // Entrambi alluminio
    if (fInt === 'alluminio' && fEst === 'alluminio') return 'ALU';
    
    // PVC interno + ALU esterno
    if (fInt === 'pvc' && fEst === 'alluminio') return 'PVC-ALU';
    
    // ALU interno + PVC esterno (raro ma possibile)
    if (fInt === 'alluminio' && fEst === 'pvc') return 'PVC-ALU';
    
    // Default: PVC-PVC
    return 'PVC';
}

// 🆕 v5.743: Ottiene telai filtrati per progetto (usa finiture da config)
function getTelaiPerProgetto(project) {
    const finituraInt = project?.configInfissi?.finituraInt || 'pvc';
    const finituraEst = project?.configInfissi?.finituraEst || 'pvc';
    const tipoTelaio = getTipoTelaioDaFinitura(finituraInt, finituraEst);
    return FINWINDOW_TELAI_PER_MATERIALE[tipoTelaio] || FINWINDOW_TELAI_OPTIONS;
}

// 🆕 v5.743: SISTEMA 3 STATI PER FLAG RILIEVO
// Stati: null = non verificato (○), 'si' = presente (✓), 'no' = assente (✗)
function ciclaStatoRilievo(currentValue) {
    if (currentValue === null || currentValue === undefined) return 'si';
    if (currentValue === 'si') return 'no';
    return null; // da 'no' torna a null
}

function getStatoRilievoUI(value) {
    if (value === 'si') {
        return { icon: '✓', color: 'green', bgColor: 'bg-green-100', borderColor: 'border-green-400', textColor: 'text-green-700' };
    } else if (value === 'no') {
        return { icon: '✗', color: 'red', bgColor: 'bg-red-100', borderColor: 'border-red-400', textColor: 'text-red-700' };
    } else {
        return { icon: '○', color: 'gray', bgColor: 'bg-gray-100', borderColor: 'border-gray-300', textColor: 'text-gray-500' };
    }
}

function renderPulsante3Stati(id, label, emoji, value, onClickFn) {
    const stato = getStatoRilievoUI(value);
    return `
        <button type="button"
                id="${id}"
                onclick="${onClickFn}"
                class="flex items-center justify-between gap-2 ${stato.bgColor} p-3 rounded-lg border-2 ${stato.borderColor} 
                       hover:shadow-md transition-all duration-200 w-full text-left cursor-pointer">
            <span class="text-sm font-semibold flex items-center gap-2">
                ${emoji} ${label}
            </span>
            <span class="text-xl font-bold ${stato.textColor} min-w-[28px] text-center">${stato.icon}</span>
        </button>
    `;
}

// MANIGLIE FIN-DOOR
const FINDOOR_MANIGLIE = {
    'set': {
        '450': { desc: 'Alluminio standard', colori: ['56', '44', '01', '02'], prezzo: 102 },
        '452': { desc: 'Alluminio placca', colori: ['56', '44', '01', '02'], prezzo: 102 },
        '401': { desc: 'Alluminio comfort', colori: ['56', '01', '02'], prezzo: 102 },
        '404': { desc: 'Alluminio premium', colori: ['56', '01', '02'], prezzo: 138 },
        '405': { desc: 'Alluminio economica', colori: ['56'], prezzo: 75.6 },
        '501-56': { desc: 'Design moderna alu', colori: ['56'], prezzo: 138 },
        '501-43': { desc: 'Design moderna inox', colori: ['43'], prezzo: 182 },
        '507': { desc: 'Acciaio inox protezione', colori: ['43'], prezzo: 298 },
        '420': { desc: 'Acciaio inox', colori: ['43'], prezzo: 281 },
        '581': { desc: 'Serie 11', colori: ['56', 'E03'], prezzo: 151 },
        '582': { desc: 'Serie 12', colori: ['56', 'E03', '43'], prezzo: 161 },
        '583': { desc: 'Serie 13', colori: ['56', 'E03', '43'], prezzo: 210 }
    },
    'maniglioni': {
        '506': { desc: 'Pomello fisso inox', prezzo: 219 },
        '487': { desc: 'Barra 90mm', prezzo: 284 },
        '488': { desc: 'Barra 98mm L485', prezzo: 509 },
        '485': { desc: 'Barra 90mm L450', prezzo: 196 },
        '468-56': { desc: 'Design 450mm alu', prezzo: 405 },
        '468-E03': { desc: 'Design 450mm nero', prezzo: 513 },
        '391': { desc: 'Compatto L300', prezzo: 130 },
        '390': { desc: 'Quadrato inox', prezzo: 255 },
        '341': { desc: 'Quadrato design', prezzo: 287 }
    },
    'colori': {
        '01': 'Bianco', '02': 'Marrone', '43': 'Acciaio inox',
        '44': 'Alu colore inox', '56': 'Alu neutro anod.', 'E03': 'Alu nero anod.'
    }
};

// COLORI ALLUMINIO FIN-DOOR
const FINDOOR_COLORI_ALU = {
    'gruppo1': {
        desc: 'Gruppo 1 (standard)',
        suppl: 0,
        colori: ['F716-Antracite', 'F905-Nero', 'F113-Bianco perla', 'M716-Antracite op.', 'M905-Nero op.', 'DB703-Antracite met.']
    },
    'gruppo1H': {
        desc: 'Gruppo 1H (decoro legno)',
        suppl: 0,
        colori: ['L13-Castagno', 'L14-Mogano', 'L16-Douglas', 'L18-Noce', 'L19-Rovere', 'L55-Noce chiaro']
    },
    'gruppo2': {
        desc: 'Gruppo 2 (+284€/ordine)',
        suppl: 284,
        colori: ['RAL a richiesta', 'F09-Bianco ghiaccio', 'F92-Grigio platino', 'LC31-Champagne', 'LC32-Dorato']
    },
    'gruppo3': {
        desc: 'Gruppo 3 (+1410€/ordine)',
        suppl: 1410,
        colori: ['NCS a richiesta', 'DB speciali']
    }
};

// 🎨 COLORI PVC FIN-DOOR (da listino EUR 2025/10 pag.149)
// 🆕 v5.67: Aggiornato con note listino ottobre 2025
const FINDOOR_COLORI_PVC = {
    'gruppoA': {
        desc: 'Gruppo A - Tonalità bianco (standard)',
        suppl: 0, // supplemento €/ml
        colori: [
            { cod: '01', nome: 'Bianco extraliscio', superficie: 'liscia' },
            { cod: '45', nome: 'Bianco satinato', superficie: 'satinata' },
            { cod: '27', nome: 'Bianco crema satinato', superficie: 'satinata' },
            { cod: '42', nome: 'Bianco goffrato', superficie: 'goffrata' },
            { cod: '07', nome: 'Bianco crema goffrato', superficie: 'goffrata' }
        ]
    },
    'gruppoB': {
        desc: 'Gruppo B - Colori scuri (+suppl.)',
        suppl: 2.82, // supplemento €/m²
        colori: [
            { cod: '36', nome: 'Grigio topo', superficie: '-', note: '⚠️ Solo ALU-ALU o ALU-LEGNO' },
            { cod: '46', nome: 'Grigio seta', superficie: 'satinata' },
            { cod: '06', nome: 'Grigio', superficie: 'satinata', note: '⚠️ SCADE sett.32/2026!' },
            { cod: '13', nome: 'Castagno decoro legno', superficie: 'goffrata' },
            { cod: '19', nome: 'Rovere decoro legno', superficie: 'goffrata' },
            { cod: '55', nome: 'Noce chiaro decoro legno', superficie: 'goffrata' }
        ]
    }
};

// Abbinamento colori PVC → Alluminio (da listino pag.149)
const FINDOOR_COLORI_PVC_ALU_MATCH = {
    '01': 'M01', '42': 'M01', '45': 'M01',  // Bianco → M01 Bianco opaco
    '07': 'F901', '27': 'F901',             // Bianco crema → F901 Bianco crema
    '46': 'F744',                           // Grigio seta → F744
    '06': 'F742',                           // Grigio → F742
    '13': 'L13',                            // Castagno → L13
    '19': 'L19',                            // Rovere → L19
    '55': 'L55'                             // Noce chiaro → L55
};

// 🚪 MATERIALI PORTONCINO FIN-DOOR
const FINDOOR_MATERIALI = {
    'PVC': { desc: 'PVC', colori: 'PVC' },
    'ALU': { desc: 'Alluminio', colori: 'ALU' }
};

// 🆕 v5.67: Combinazioni materiali Int-Est disponibili (aggiornato da listino 10/2025)
const FINDOOR_COMBINAZIONI_MAT = [
    { int: 'PVC', est: 'PVC', desc: 'PVC - PVC (interno-esterno)' },
    { int: 'PVC', est: 'ALU', desc: 'PVC int. - Alluminio est.' },
    { int: 'PVC', est: 'LEGNO', desc: 'PVC int. - Legno est.' },
    { int: 'ALU', est: 'PVC', desc: 'Alluminio int. - PVC est.' },
    { int: 'ALU', est: 'ALU', desc: 'Alluminio - Alluminio' },
    { int: 'ALU', est: 'LEGNO', desc: 'Alluminio int. - Legno est.' },
    { int: 'LEGNO', est: 'PVC', desc: 'Legno int. - PVC est.' },
    { int: 'LEGNO', est: 'ALU', desc: 'Legno int. - Alluminio est.' }
];

// ═══════════════════════════════════════════════════════════════════════════════
// 🆕 v5.23: FUNZIONI HELPER PER COMBINAZIONI MATERIALI PORTONCINO
// ═══════════════════════════════════════════════════════════════════════════════

// Ottiene combinazione materiali da config portoncino
function getCombinazioneMat(ptc) {
    const matInt = ptc.materialeInt || 'PVC';
    let matEst = ptc.materialeEst || 'PVC';
    
    // 🆕 v5.67: Rimossa forzatura ALU esterno - ora tutte le combinazioni sono valide
    // Valida che la combinazione sia tra quelle disponibili
    const combDisponibili = FINDOOR_COMBINAZIONI[matInt] || ['PVC'];
    if (!combDisponibili.includes(matEst)) {
        matEst = combDisponibili[0];
    }
    
    const result = `${matInt}-${matEst}`;
    console.log(`🧱 getCombinazioneMat: int=${matInt}, est=${matEst} → ${result}`);
    return result;
}

// Ottiene materiali esterni disponibili per materiale interno
function getMaterialiEstPerInt(matInt) {
    return FINDOOR_COMBINAZIONI[matInt] || ['PVC'];
}

// Ottiene forme telaio disponibili per combinazione
function getFormeTelaioPerComb(comb) {
    const telaiComb = FINDOOR_TELAI_PER_COMB[comb];
    if (!telaiComb) return [];
    
    const forme = [];
    if (telaiComb['L']) forme.push({ cod: 'L', desc: 'L - Apertura interno' });
    if (telaiComb['L-EST']) forme.push({ cod: 'L-EST', desc: 'L - Apertura esterno' });
    if (telaiComb['Z']) forme.push({ cod: 'Z', desc: 'Z - Per controtelaio' });
    if (telaiComb['T']) forme.push({ cod: 'T', desc: 'T - Forma a T' });
    
    return forme;
}

// Ottiene telai disponibili per combinazione e forma
function getTelaiPerCombForma(comb, forma) {
    const telaiComb = FINDOOR_TELAI_PER_COMB[comb];
    if (!telaiComb || !telaiComb[forma]) return [];
    
    return Object.entries(telaiComb[forma]).map(([cod, t]) => ({
        cod,
        desc: t.desc,
        spessore: t.spessore,
        note: t.note
    }));
}

// Ottiene tipi anta disponibili per combinazione
function getAntePerComb(comb) {
    return FINDOOR_ANTE_PER_COMB[comb] || [];
}

// Controlla combinazione e aggiorna campi correlati
function checkCombinazioneAndUpdate(projectId, posId) {
    const project = state.projects.find(p => p.id === projectId);
    if (!project) return;
    const pos = project.positions.find(p => p.id === posId);
    if (!pos || !pos.ingresso?.portoncino) return;
    
    const ptc = pos.ingresso.portoncino;
    const comb = getCombinazioneMat(ptc);
    
    // 🆕 v5.66: Rimossa logica che forzava ALU esterno per ALU/LEGNO interno
    // Ora tutte le combinazioni sono possibili secondo listino Finstral 10/2025
    // Validazione: verifica che la combinazione sia tra quelle disponibili
    const combDisponibili = FINDOOR_COMBINAZIONI[ptc.materialeInt] || ['PVC'];
    if (ptc.materialeEst && !combDisponibili.includes(ptc.materialeEst)) {
        // Se combinazione non valida, resetta a prima opzione disponibile
        ptc.materialeEst = combDisponibili[0];
        console.log(`🔧 v5.66: Reset materialeEst a ${ptc.materialeEst} (combinazione non valida)`);
    }
    
    // Reset telaio se forma non disponibile
    const formeDisp = getFormeTelaioPerComb(comb);
    if (ptc.formaTelaio && !formeDisp.find(f => f.cod === ptc.formaTelaio)) {
        ptc.formaTelaio = formeDisp.length > 0 ? formeDisp[0].cod : '';
        ptc.codTelaio = '';
    }
    
    // Reset tipo anta se non disponibile
    const anteDisp = getAntePerComb(comb);
    if (ptc.tipoAnta && !anteDisp.find(a => a.cod === ptc.tipoAnta)) {
        ptc.tipoAnta = anteDisp.length > 0 ? anteDisp[0].cod : '';
    }
    
    // Reset gruppi colore in base a materiale INTERNO
    if (ptc.materialeInt === 'PVC') {
        if (!ptc.gruppoColoreInt?.startsWith('gruppoA') && !ptc.gruppoColoreInt?.startsWith('gruppoB')) {
            ptc.gruppoColoreInt = 'gruppoA';
            ptc.coloreInt = '';
        }
    } else if (ptc.materialeInt === 'ALU') {
        if (!ptc.gruppoColoreInt?.match(/^gruppo[0-3]$/) && !ptc.gruppoColoreInt?.match(/^gruppo1H$/)) {
            ptc.gruppoColoreInt = 'gruppo1';
            ptc.coloreInt = '';
        }
    } else if (ptc.materialeInt === 'LEGNO') {
        if (!ptc.gruppoColoreInt?.match(/^gruppo[0-3]$/)) {
            ptc.gruppoColoreInt = 'gruppo0';
            ptc.coloreInt = '';
        }
    }
    
    // Reset gruppi colore in base a materiale ESTERNO
    if ((ptc.materialeEst || 'PVC') === 'PVC') {
        if (!ptc.gruppoColoreEst?.startsWith('gruppoA') && !ptc.gruppoColoreEst?.startsWith('gruppoB')) {
            ptc.gruppoColoreEst = 'gruppoA';
            ptc.coloreEst = '';
        }
    } else if (ptc.materialeEst === 'ALU') {
        if (!ptc.gruppoColoreEst?.match(/^gruppo[0-3]$/) && !ptc.gruppoColoreEst?.match(/^gruppo1H$/)) {
            ptc.gruppoColoreEst = 'gruppo1';
            ptc.coloreEst = '';
        }
    } else if (ptc.materialeEst === 'LEGNO') {
        // 🆕 v5.66: Gestione gruppi colore LEGNO esterno
        if (!ptc.gruppoColoreEst?.match(/^gruppo[0-4]$/)) {
            ptc.gruppoColoreEst = 'gruppo1';
            ptc.coloreEst = '';
        }
    }
    
    console.log(`🧱 v5.23: Combinazione ${comb} - forme: ${formeDisp.map(f=>f.cod).join(',')}, ante: ${anteDisp.length}`);
    
    saveState();
    render();
}

// Funzione calcolo prezzo base portoncino
function calcolaPrezzoBasePortoncino(larghezza, altezza, tipoTabella) {
    const tab = FINDOOR_PREZZI_BASE[tipoTabella];
    if (!tab) return 0;
    
    // Trova indice colonna (larghezza >= valore)
    let idxL = 0;
    for (let i = 0; i < tab.larghezze.length; i++) {
        if (larghezza <= tab.larghezze[i]) { idxL = i; break; }
        idxL = i;
    }
    
    // Trova riga altezza
    const altezze = Object.keys(tab.prezzi).map(Number).sort((a,b) => a-b);
    let rigaH = altezze[0];
    for (const h of altezze) {
        if (altezza <= h) { rigaH = h; break; }
        rigaH = h;
    }
    
    return tab.prezzi[rigaH]?.[idxL] || 0;
}

// Funzione calcolo supplemento modello anta
function calcolaSupplModelloAnta(modello, tipoAnta, isGrande) {
    let mod = FINDOOR_MODELLI_ANTA[modello];
    if (!mod) return 0;
    if (mod.stessoPrezzoDi) mod = FINDOOR_MODELLI_ANTA[mod.stessoPrezzoDi];
    if (!mod?.prezzi) return 0;
    
    // Determina categoria: FLAT_PLANAR, STEP_PLANAR, STEP_FRAME
    let cat = 'STEP_PLANAR';
    if (tipoAnta.includes('FLAT_PLANAR')) cat = 'FLAT_PLANAR';
    else if (tipoAnta.includes('STEP_FRAME') || tipoAnta.includes('FLAT_FRAME')) cat = 'STEP_FRAME';
    
    const prezzi = mod.prezzi[cat];
    if (!prezzi) return 0;
    return isGrande ? prezzi[1] : prezzi[0];
}

// 📄 Aggiorna title dinamicamente
document.title = `Open Porte v${APP_VERSION} - ${APP_VERSION_NOTE}`;

// 🚨 LOG VERSIONE - AUTOMATICO
console.log('%c╔═══════════════════════════════════════════════╗', 'color: #16a34a; font-weight: bold; font-size: 14px;');
console.log(`%c║   🚪 OPEN PORTE v${APP_VERSION} CARICATO! ✅           ║`, 'color: #16a34a; font-weight: bold; font-size: 14px;');
console.log(`%c║   ${APP_VERSION_NOTE}!           ║`, 'color: #16a34a; font-weight: bold; font-size: 14px;');
console.log('%c╚═══════════════════════════════════════════════╝', 'color: #16a34a; font-weight: bold; font-size: 14px;');
console.log(`%c🔧 v${APP_VERSION}:`, 'color: #dc2626; font-weight: bold; font-size: 13px;');
console.log('  📦 CASSONETTI CONDIZIONALI: Finstral vs Magò/Alpac');
console.log('  🏢 Finstral: checkbox+text (Cassonetto, Posa, Colore AUTO, Isolamento, Soffitto)');
console.log('  🏢 Magò/Alpac: select (Tipo, Posa, Finitura) - campi 5-6 nascosti');
console.log('  ✅ Config Globale + Tab Posizioni implementate');
console.log('%c🔧 v4.69:', 'color: #2563eb; font-weight: bold; font-size: 13px;');
console.log('  ✅ 3 OPZIONI TAPPARELLE SEMPRE VISIBILI: Manuale | Motore esistente | Motorizzata');
console.log(' ');


console.log('✅ finstral.js caricato');
