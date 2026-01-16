// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 DATABASE PERSIANE - Colori, Cardini, Fermapersiane
// ═══════════════════════════════════════════════════════════════════════════════

// 🎨 COSTANTE COLORI PERSIANE
const COLORI_PERSIANE = [
    'CPF910L - Bianco puro tipo Ral 9010 opaco',
    'CPF113L - Bianco perla tipo Ral1013 opaco',
    'CPF701L - Grigio argento tipo Ral 7001 opaco',
    'CPF716L - Antracite tipo Ral 7016 opaco',
    'CPF605L - Verde muschio tipo Ral 6005 opaco',
    'CPF609T - Verde abete textured tipo Ral 6009 ruvido',
    'CPF817L - Marrone cioccolato tipo Ral 8017 opaco',
    'CPF735L - Grigio luce tipo Ral 7035 opaco',
    'CPF609L - Verde abete tipo Ral6009 semiopaco',
    'CPF621L - Verde pallido tipo Ral 6021 opaco',
    'CPF119L - Beige tipo Ral 1019 opaco Grigio',
    'CPF524L - Azzurro pastello tipo Ral 5024 opaco',
    'CPF811L - Marrone Nuss tipo Ral 8011 opaco',
    'CPF910T - Bianco puro textured tipo Ral 9010 ruvido',
    'CPF113T - Bianco perla textured tipo Ral 1013 ruvido',
    'CPF701T - Grigio argento textured tipo Ral 7001 ruvido',
    'CPF305T - Rosso vino textured tipo Ral 3005 ruvido',
    'CPF605T - Verde foglia textured tipo Ral 6005 ruvido',
    'CPF817T - Marrone cioccolato textured tipo Ral 8017 ruvido',
    'CPF820H - Grey Oak',
    'CPF818H - Renolit Vulcano',
    'CPF813H - Renolit Gold',
    'CPFR811 - Marrone Renolit scuro',
    'CPF812H - Marrone Renolit dorato',
    'CPFN630 - Acacia - effetto rigato',
    'CPFN632 - Noce Reale - effetto rigato',
    'CPF90RC - Marrone RENOLIT CHIARO ruvido',
    'CPF91RS - Marrone RENOLIT SCURO ruvido',
    'CPF51CR - Marrone ciliegio Renoir ruvido',
    'CPF358R - Douglas tipo 335-S0R',
    'CPF127R - Noce scuro ruvido tipo 102-50R',
    'CPF375R - Castagno chiaro ruvido tipo 375-S0R',
    'CPF378R - Castagno scuro ruvido tipo 378-50R',
    'CPF317R - Ciliegio chiaro ruvido tipo 317-50R',
    'CPF70KA - Winchester',
    'CPFSLV7 - Verde Salvia',
    'CPFRGG4 - Ruggine EVO',
    'CPF744L - Grigio seta tipo RAL 7044 opaco'
];

// 🔩 COSTANTE CARDINI PUNTO PERSIANE (pag. 190)
const CARDINI_PUNTO_PERSIANE = [
    { codice: 'C.SAF90', nome: 'Cardine SAF 90mm (facciata)', prezzo: 0 },
    { codice: 'C.SAF150', nome: 'Cardine SAF 150mm (cappotto)', prezzo: 0 },
    { codice: 'C.SAF240', nome: 'Cardine SAF 240mm (cappotto spesso)', prezzo: 0 },
    { codice: 'C.SAF320', nome: 'Cardine SAF 320mm (cappotto XL)', prezzo: 0 },
    { codice: 'C.REG.SAF90', nome: 'Cardine Regolabile 90mm', prezzo: 0 },
    { codice: 'C.REG.SAF150', nome: 'Cardine Regolabile 150mm', prezzo: 0 },
    { codice: 'CHA.1', nome: 'Cardine mensola lama stretta', prezzo: 18.00 }
];

// 🔒 COSTANTE FERMAPERSIANE PUNTO PERSIANE (pag. 182)
const FERMAPERSIANE_PUNTO_PERSIANE = [
    { codice: 'K.EASY', nome: 'Ferma KOMFORT a scomparsa', prezzo: 56.00 },
    { codice: 'F.INC', nome: 'Fermo Piemontese incassato', prezzo: 45.00 },
    { codice: 'GRILLO', nome: 'Ferma tipo Grillo', prezzo: 0 },
    { codice: 'SALTARELLO', nome: 'Ferma tipo Saltarello', prezzo: 0 },
    { codice: 'PIEMONTESE', nome: 'Ferma tipo Piemontese', prezzo: 0 },
    { codice: 'OMETTO', nome: 'Ferma tipo Ometto (pavimento)', prezzo: 0 }
];

// 🧮 CALCOLO AUTOMATICO CARDINI PER TIPOLOGIA
// Valori da listino Punto Persiane
function calcolaCardiniPersiana(tipologia, aperturaLibro = false) {
    const cardiniBase = {
        'F1': 2, 'F2': 4, 'F3': 5, 'F4': 6,
        'PF1': 3, 'PF2': 6, 'PF3': 7, 'PF4': 8
    };
    let qta = cardiniBase[tipologia] || 2;
    if (aperturaLibro) qta += 1; // +1 se apertura a libro
    return qta;
}

// 🧮 CALCOLO AUTOMATICO FERMAPERSIANE (1 per anta)
function calcolaFermapersiane(tipologia) {
    const antePerTipo = {
        'F1': 1, 'F2': 2, 'F3': 3, 'F4': 4,
        'PF1': 1, 'PF2': 2, 'PF3': 3, 'PF4': 4
    };
    return antePerTipo[tipologia] || 1;
}

console.log('✅ persiane.js caricato');
