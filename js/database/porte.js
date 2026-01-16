// ═══════════════════════════════════════════════════════════════════════════════
// 🚪 DATABASE PORTE INTERNE - FerreroLegno & Flessya
// ═══════════════════════════════════════════════════════════════════════════════

const PORTE_DATABASE = {
    FERREROLEGNO: {
        linee: {
            "Collezioni FL": {
                collezioni: ["EXIT", "EQUA", "NOVA", "GLASS", "INTAGLIO", "PLISSÈ", "SUITE", "MIXY", "YNCISA", "KÉVIA", "DIVA", "EPOCA", "TALENTO", "MITO", "ARCA", "TEMPORA", "MUSA", "MAGIKA"],
                telai: ["T1 Evoluto Eleva", "T2 Minimal Eleva", "T3 Genius Eleva", "T4 Flat", "T5 Quality Eleva"],
                finiture: {
                    "EXIT": ["Grezzo Prefinito", "Iride", "Natural Touch Rovere", "Natural Touch Noce", "ULTRAlucido"],
                    "EQUA": ["Tanganika", "Noce Nazionale", "Opaco", "ULTRAopaco"],
                    "NOVA": ["Iride", "Natural Touch Rovere", "Natural Touch Noce", "Opaco"],
                    "GLASS": ["Iride", "Natural Touch Rovere", "Natural Touch Noce", "Opaco", "ULTRAlucido"],
                    "INTAGLIO": ["Grezzo Prefinito", "Iride", "Natural Touch Rovere", "Opaco", "ULTRAopaco"],
                    "PLISSÈ": ["Grezzo Prefinito", "Iride", "Natural Touch Rovere", "Opaco", "ULTRAopaco"],
                    "SUITE": ["Tanganika", "Noce Nazionale", "Opaco", "ULTRAopaco"],
                    "MIXY": ["Tanganika", "Noce Nazionale", "Opaco", "ULTRAopaco"],
                    "YNCISA": ["Tanganika", "Noce Nazionale", "Opaco", "ULTRAopaco"],
                    "KÉVIA": ["Tanganika", "Noce Nazionale", "Opaco", "ULTRAopaco"],
                    "DIVA": ["Tanganika", "Noce Nazionale", "Opaco", "ULTRAopaco"],
                    "EPOCA": ["Tanganika", "Noce Nazionale", "Opaco", "ULTRAopaco"],
                    "TALENTO": ["Tanganika", "Noce Nazionale", "Opaco", "ULTRAopaco"],
                    "MITO": ["Tanganika", "Noce Nazionale", "Opaco", "ULTRAopaco"],
                    "ARCA": ["Tanganika", "Noce Nazionale", "Opaco", "ULTRAopaco"],
                    "TEMPORA": ["Tanganika", "Noce Nazionale", "Opaco", "ULTRAopaco"],
                    "MUSA": ["Opaco", "ULTRAopaco", "ULTRAlucido"],
                    "MAGIKA": ["Opaco", "ULTRAopaco", "ULTRAlucido"]
                }
            },
            "Replica": {
                collezioni: ["LISS", "LISS VETRO LARGE", "LOGICA", "TRATTO", "SEGNI", "AREA", "FORMA", "FOLD"],
                telai: ["T3 Genius Eleva", "T4 Flat", "T7 Oval Eleva"],
                finiture: {
                    "LISS": ["Ontario Perla", "Ontario Cenere", "Ontario Sabbia", "Ontario Polvere", "Ontario Cuoio", "Ontario Noce", "Ontario Platino", "Grafis Bianco", "Grafis Beige", "Grafis Moka", "Materic Greige", "Materic Noir", "Materic Bianco"],
                    "LISS VETRO LARGE": ["Ontario Perla", "Ontario Cenere", "Ontario Sabbia", "Grafis Bianco", "Grafis Beige", "Materic Greige", "Materic Bianco"],
                    "LOGICA": ["Ontario Perla", "Ontario Cenere", "Ontario Sabbia", "Ontario Polvere", "Ontario Cuoio", "Ontario Noce", "Grafis Bianco", "Grafis Beige", "Grafis Moka", "Materic Greige", "Materic Noir"],
                    "TRATTO": ["Ontario Perla", "Ontario Cenere", "Ontario Sabbia", "Grafis Bianco", "Grafis Moka"],
                    "SEGNI": ["Ontario Perla", "Ontario Cenere", "Ontario Sabbia", "Grafis Bianco"],
                    "AREA": ["Ontario Perla", "Ontario Cenere", "Grafis Bianco", "Materic Greige"],
                    "FORMA": ["Ontario Perla", "Ontario Cenere", "Ontario Sabbia", "Grafis Bianco", "Grafis Beige"],
                    "FOLD": ["Ontario Perla", "Ontario Cenere", "Grafis Bianco"]
                }
            },
            "Zero": {
                collezioni: ["EQUA Zero", "INTAGLIO Zero", "PLISSÈ Zero", "SUITE Zero", "MIXY Zero", "YNCISA Zero", "LISS Zero", "LOGICA Zero", "FOLD Zero", "BASIC Zero", "FRAME Zero", "PREMIUM Zero"],
                telai: ["A_FILO", "Concept"],
                finiture: {
                    "EQUA Zero": ["Grezzo Prefinito", "Opaco", "ULTRAopaco"],
                    "INTAGLIO Zero": ["Grezzo Prefinito", "Opaco", "ULTRAopaco"],
                    "PLISSÈ Zero": ["Grezzo Prefinito", "Opaco", "ULTRAopaco"],
                    "SUITE Zero": ["Grezzo Prefinito", "Opaco", "ULTRAopaco"],
                    "MIXY Zero": ["Grezzo Prefinito", "Opaco", "ULTRAopaco"],
                    "YNCISA Zero": ["Grezzo Prefinito", "Opaco", "ULTRAopaco"],
                    "LISS Zero": ["Opaco", "ULTRAopaco", "ULTRAlucido"],
                    "LOGICA Zero": ["Opaco", "ULTRAopaco"],
                    "FOLD Zero": ["Opaco", "ULTRAopaco"],
                    "BASIC Zero": ["Grezzo Prefinito", "Opaco", "ULTRAopaco"],
                    "FRAME Zero": ["Opaco", "ULTRAopaco", "ULTRAlucido"],
                    "PREMIUM Zero": ["Opaco", "ULTRAopaco", "ULTRAlucido"]
                }
            }
        }
    },
    FLESSYA: {
        linee: {
            "Standard": {
                collezioni: ["NIDIO", "NIDIO INCISE", "TALÈA", "CLASSIKA", "PLENIA", "KIKKA", "S-NZIALE", "VETRA"],
                telai: ["Lineo + Recta", "Lineo + Sagoma", "Lineo + Curva", "Lineo + Plana", "Lineo + Ampia", "Lineo + Barocca", "Radius + Recta", "Radius + Curva", "Radius + Sagoma", "Radius + Barocca"],
                finiture: {
                    "NIDIO": ["Laccato Bianco RAL 9016", "Laccato Bianco Crema RAL 9001", "Laccato Bianco Puro RAL 9010", "Laccato Avorio RAL 1013", "Laccato Base", "Laccato Extra", "Laccato Colori Idea", "Laccato Corten", "Laccato Lucido", "Rovere", "Rovere Crudo", "Rovere Nodato", "Rovere Cenere", "Rovere Grigio", "Rovere Sbiancato", "Rovere Caffè", "Rovere Tabacco", "Rovere Decapè", "Tanganika", "Tanganika Cuoio", "Tanganika Tabacco", "Tanganika Ciliegio", "Frassino", "Frassino Sbiancato", "Frassino Antico", "Noce Biondo", "Noce Nazionale Bicolore"],
                    "NIDIO INCISE": ["Laccato Bianco RAL 9016", "Laccato Bianco Crema RAL 9001", "Laccato Avorio RAL 1013", "Laccato Base", "Laccato Extra", "Laccato Colori Idea"],
                    "TALÈA": ["Laccato Bianco RAL 9016", "Laccato Avorio RAL 1013", "Laccato Base", "Laccato Extra", "Tanganika", "Tanganika Cuoio", "Rovere", "Rovere Grigio", "Frassino"],
                    "CLASSIKA": ["Laccato Bianco RAL 9016", "Laccato Avorio RAL 1013", "Laccato Base", "Laccato Extra", "Laccato Lucido"],
                    "PLENIA": ["Laccato Bianco RAL 9016", "Laccato Avorio RAL 1013", "Laccato Base", "Laccato Extra", "Goffrato"],
                    "KIKKA": ["Laccato Bianco RAL 9016", "Laccato Base", "Laccato Extra", "Tanganika", "Tanganika Cuoio", "Rovere", "Rovere Grigio", "Frassino Poro Aperto"],
                    "S-NZIALE": ["Laccato Bianco RAL 9016", "Laccato Base", "Laccato Extra", "Rovere", "Rovere Grigio", "Tanganika"],
                    "VETRA": ["Alluminio Argento", "Alluminio Nero", "Vetro Trasparente", "Vetro Trasparente Grigio", "Vetro Trasparente Bronzo", "Vetro Semiriflettente Grigio"]
                }
            }
        }
    }
};

// Funzioni helper
// 🚪 v5.61: Funzione per ottenere le linee di un'azienda
window.getLineePorta = function(azienda) {
    if (!azienda || !PORTE_DATABASE[azienda]) return [];
    return Object.keys(PORTE_DATABASE[azienda].linee).sort();
};

// 🚪 v5.61: Funzione per ottenere collezioni in base all'azienda e linea
window.getCollezioniPorta = function(azienda, linea) {
    if (!azienda || !PORTE_DATABASE[azienda]) return [];
    if (!linea) {
        // Retrocompatibilità: se non c'è linea, ritorna tutte le collezioni
        let allColl = [];
        Object.values(PORTE_DATABASE[azienda].linee).forEach(l => {
            allColl = allColl.concat(l.collezioni);
        });
        return [...new Set(allColl)].sort();
    }
    return PORTE_DATABASE[azienda].linee[linea]?.collezioni || [];
};

// 🚪 v5.61: Funzione per ottenere telai in base all'azienda e linea
window.getTelaiPorta = function(azienda, linea) {
    if (!azienda || !linea || !PORTE_DATABASE[azienda]) return [];
    return PORTE_DATABASE[azienda].linee[linea]?.telai || [];
};

// 🚪 v5.61: Funzione per ottenere finiture in base all'azienda, linea e collezione
window.getFiniturePora = function(azienda, linea, collezione) {
    if (!azienda || !PORTE_DATABASE[azienda]) return [];
    
    // Retrocompatibilità: se linea non specificata, cerca in tutte
    if (!linea && collezione) {
        for (const [nomeLinea, datiLinea] of Object.entries(PORTE_DATABASE[azienda].linee)) {
            if (datiLinea.finiture[collezione]) {
                return datiLinea.finiture[collezione];
            }
        }
        return [];
    }
    
    if (!collezione || !PORTE_DATABASE[azienda].linee[linea]) return [];
    return PORTE_DATABASE[azienda].linee[linea].finiture[collezione] || [];
};

// Funzione per aggiornare dropdown collezione
window.updateCollezioneDropdown = function(projectId, positionId) {
    const project = state.projects.find(p => p.id === projectId);
    const pos = project?.positions.find(p => p.id === positionId);
    if (!pos || !pos.portaInterna) return;
    
    const azienda = pos.portaInterna.azienda;
    const collezioni = getCollezioniPorta(azienda);
    const select = document.getElementById('collezione-' + positionId);
    if (!select) return;
    // Funzione placeholder - TODO: implementare logica completa se necessario
};

console.log('✅ porte.js caricato');
