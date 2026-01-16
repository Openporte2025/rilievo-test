// ═══════════════════════════════════════════════════════════════════════════════
// ☀️ DATABASE GIBUS - Click Zip e Tende da Sole
// ═══════════════════════════════════════════════════════════════════════════════

// ☀️ v5.63: Database GIBUS Click Zip e Tende da Sole
const GIBUS_DATABASE = {
    sconto: 48,
    // CLICK ZIP - Schermature solari
    clickZip: {
        "ZIP_9": {
            nome: "Click Zip 9",
            cassonetto: "9x9 cm",
            limiti: { larghezzaMin: 60, larghezzaMax: 300, altezzaMin: 100, altezzaMax: 240 },
            resistenzaVento: "Classe 6"
        },
        "ZIP_11": {
            nome: "Click Zip 11",
            cassonetto: "11x12,6 cm",
            limiti: { larghezzaMin: 60, larghezzaMax: 400, altezzaMin: 100, altezzaMax: 380 },
            resistenzaVento: "Classe 6",
            variante: "UP (fissaggio soffitto)"
        },
        "ZIP_13": {
            nome: "Click Zip 13",
            cassonetto: "13x14,6 cm",
            limiti: { larghezzaMin: 60, larghezzaMax: 500, altezzaMin: 100, altezzaMax: 480 },
            resistenzaVento: "Classe 6",
            variante: "UP (fissaggio soffitto)"
        },
        "ZIP_15": {
            nome: "Click Zip 15",
            cassonetto: "15x15 cm",
            limiti: { larghezzaMin: 69, larghezzaMax: 700, altezzaMin: 100, altezzaMax: 480 },
            resistenzaVento: "Classe 5/6"
        },
        "ZIP_GHOST_11": {
            nome: "Click Zip Ghost 11",
            cassonetto: "11x15 cm (frontale scomparsa)",
            limiti: { larghezzaMin: 64, larghezzaMax: 400, altezzaMin: 100, altezzaMax: 380 },
            resistenzaVento: "Classe 6"
        },
        "ZIP_GHOST_15": {
            nome: "Click Zip Ghost 15",
            cassonetto: "15x19,2 cm (frontale scomparsa)",
            limiti: { larghezzaMin: 60, larghezzaMax: 700, altezzaMin: 100, altezzaMax: 480 },
            resistenzaVento: "Classe 5/6"
        },
        "ZIP_TWIN": {
            nome: "Click Zip Twin",
            cassonetto: "13x25 cm (2 teli)",
            limiti: { larghezzaMin: 60, larghezzaMax: 480, altezzaMin: 100, altezzaMax: 340 },
            resistenzaVento: "Classe 6"
        },
        "ZIP_NAKED": {
            nome: "Click Zip Naked",
            cassonetto: "Senza cassonetto",
            limiti: { larghezzaMin: 60, larghezzaMax: 500, altezzaMin: 100, altezzaMax: 480 },
            resistenzaVento: "Classe 6"
        }
    },
    // TENDE A BRACCI IN CASSONETTO
    tendeBracci: {
        "TXT": {
            nome: "TXT",
            tipo: "Bracci in cassonetto",
            bracci: "EDGE 75 TEX",
            sporgenze: [200, 250, 300, 350, 400]
        },
        "SEGNO": {
            nome: "SEGNO",
            tipo: "Bracci in cassonetto",
            note: "Cassonetto apribile"
        },
        "NODO": {
            nome: "NODO",
            tipo: "Bracci in cassonetto",
            note: "Design compatto"
        },
        "DUCK": {
            nome: "DUCK",
            tipo: "Bracci in cassonetto",
            note: "Design contemporaneo"
        },
        "SCRIGNO_250": {
            nome: "SCRIGNO 250",
            tipo: "Bracci in cassonetto",
            sporgenze: [200, 250]
        }
    },
    // TENDE A BRACCI APERTI
    tendeBracciAperti: {
        "COMBI_60": { nome: "COMBI 60", bracci: "60 mm" },
        "SPAZIO_60": { nome: "SPAZIO 60", bracci: "60 mm" },
        "SPAZIO_75": { nome: "SPAZIO 75", bracci: "75 mm" }
    },
    // TESSUTI
    tessuti: ["Acrylic", "Polyester", "Soltis 86", "Soltis 92", "Serge 600", "Starscreen", "Cristal"],
    // COLORI STRUTTURA
    coloriStruttura: ["Bianco RAL 9010", "Bianco RAL 9016", "Beige RAL 1013", "Grigio RAL 7035", 
                      "Antracite 416", "Inox Chiaro", "Marrone RAL 8017", "Nero RAL 9005"]
};

// ☀️ v5.63: Funzioni helper GIBUS
window.getModelliGibus = function(categoria) {
    if (categoria === 'click_zip') return Object.keys(GIBUS_DATABASE.clickZip);
    if (categoria === 'tende_bracci') return Object.keys(GIBUS_DATABASE.tendeBracci);
    if (categoria === 'tende_aperte') return Object.keys(GIBUS_DATABASE.tendeBracciAperti);
    return [];
};

window.getInfoModelloGibus = function(modello) {
    return GIBUS_DATABASE.clickZip[modello] || 
           GIBUS_DATABASE.tendeBracci[modello] || 
           GIBUS_DATABASE.tendeBracciAperti[modello] || null;
};

console.log('✅ gibus.js caricato');
