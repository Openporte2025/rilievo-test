// ═══════════════════════════════════════════════════════════════════════════════
// 🦟 DATABASE PALAGINA ZANZARIERE - Linee, Modelli, Colori, Reti
// ═══════════════════════════════════════════════════════════════════════════════

// ============================================================================
// DATABASE PALAGINA ZANZARIERE (per cascata dinamica)
// ============================================================================
const PALAGINA_ZANZARIERE = {
    linee: {
        'SINTESI': { nome: 'Linea SINTESI', tipo: 'Avvolgibile' },
        'SV': { nome: 'Linea SV (NEW 2025)', tipo: 'Avvolgibile economica' },
        'EVO': { nome: 'Linea EVO (NEW 2025)', tipo: 'Speciali/Lucernari' },
        'COMPATTO': { nome: 'Serie X - COMPATTO', tipo: 'Compatta' }
    },
    modelli: {
        'SINTESI': [
            { id: 'EXTREMA', nome: 'EXTREMA', cassonetti: '-', maxH: 230 },
            { id: 'EXTREMA_CENTRALE', nome: 'EXTREMA Centrale', cassonetti: '-', maxH: 230 },
            { id: 'EXTREMA_SR', nome: 'EXTREMA SR', cassonetti: '-', maxH: 460 },
            { id: 'EXTREMA_INCASSO', nome: 'EXTREMA Incasso', cassonetti: '46/50', maxH: 230 },
            { id: 'EXTREMA_INCASSO_CENTRALE', nome: 'EXTREMA Incasso Centrale', cassonetti: '46/50', maxH: 460 },
            { id: 'EXTREMA_INCASSO_SR', nome: 'EXTREMA Incasso SR', cassonetti: '46/50', maxH: 460 },
            { id: 'NANO_SINTESI', nome: 'NANO SINTESI', cassonetti: '22', maxH: 180 },
            { id: 'MICRO_SINTESI', nome: 'MICRO SINTESI', cassonetti: '36', maxH: 200 },
            { id: 'MICRO_SINTESI_CENTRALE', nome: 'MICRO SINTESI Centrale', cassonetti: '36', maxH: 200 },
            { id: 'SINTESI', nome: 'SINTESI', cassonetti: '46/50', maxH: 210 },
            { id: 'SINTESI_CENTRALE', nome: 'SINTESI Centrale', cassonetti: '46/50', maxH: 210 },
            { id: 'SINTESI_INCASSO', nome: 'SINTESI Incasso', cassonetti: '46/50', maxH: 210 },
            { id: 'SINTESI_INCASSO_CENTRALE', nome: 'SINTESI Incasso Centrale', cassonetti: '46/50', maxH: 420 }
        ],
        'SV': [
            { id: 'SV_700', nome: 'SV 700', cassonetti: '45/50', maxH: 250, note: 'Rete HC di serie' }
        ],
        'EVO': [
            { id: 'EVO_ROOF', nome: 'EVO ROOF', cassonetti: '40', maxH: 150, note: 'Per lucernari' }
        ],
        'COMPATTO': [
            { id: 'X1_INCASSO', nome: 'Serie X - X1 Incasso', cassonetti: '50', maxH: 200 },
            { id: 'X3_LUCE', nome: 'Serie X - X3 Luce', cassonetti: '53', maxH: 200 }
        ]
    },
    colori: {
        // 🆕 v5.717: Colori completi da catalogo ufficiale Palagina
        F1: [
            { cod: '1', nome: '1 - Argento OX' },
            { cod: '5', nome: '5 - Bianco 9010' },
            { cod: '6', nome: '6 - Avorio 1013' },
            { cod: '10', nome: '10 - Grigio polvere 7037' },
            { cod: '27', nome: '27 - Testa di moro' },
            { cod: '28', nome: '28 - Nero 9011 OP' },
            { cod: '30', nome: '30 - Bianco crema 9001' },
            { cod: '35', nome: '35 - Bronzo Verniciato' },
            { cod: '41', nome: '41 - Bianco 9010 OP' },
            { cod: '46', nome: '46 - Grigio chiaro 7035' },
            { cod: '49', nome: '49 - Verde 6005 OP' },
            { cod: '90', nome: '90 - Marrone 8017 OP' },
            { cod: '91', nome: '91 - Grigio silver 9006' },
            { cod: '94', nome: '94 - Avorio 1013 OP' }
        ],
        F2: [
            { cod: '13', nome: '13 - Grigio Michelangelo' },
            { cod: '29', nome: '29 - Ferro micaceo' },
            { cod: '78', nome: '78 - Grigio antracite 7016 Sablé' }
        ],
        F3: [
            { cod: '17', nome: '17 - Rovere P9' },
            { cod: '26', nome: '26 - Renolit chiaro 386-73/R' },
            { cod: '32', nome: '32 - Renolit scuro 387-70/R' },
            { cod: '33', nome: '33 - Noce 369-70/R' },
            { cod: '37', nome: '37 - Douglas 335.80/R' },
            { cod: '48', nome: '48 - Rovere Scuro 474-123/R' }
        ]
    },
    reti: [
        { id: 'STD', nome: 'Standard PP' },
        { id: 'HC', nome: 'HC Alto Contrasto (nera)' },
        { id: 'FV', nome: 'Fibra vetro grigia' },
        { id: 'AB', nome: 'Anti-batterica' },
        { id: 'AT', nome: 'Alta trasparenza nera (+€5/m²)' },
        { id: 'SOL', nome: 'Solar 0,35 (+€9,50/m²)' }
    ],
    coloriPlastica: ['Bianco', 'Avorio', 'Marrone', 'Nero', 'Bronzo', 'Grigio']
};

console.log('✅ palagina.js caricato');
