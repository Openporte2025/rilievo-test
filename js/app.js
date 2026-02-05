/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 📋 CAMPI PRODOTTI - Definizione centralizzata campi per tutti i prodotti
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * v1.0.0 (05/02/2026): Creazione iniziale
 * 
 * SCOPO: UN file definisce i campi → entrambe le app lo leggono
 * - App Rilievo: genera form touch iPad
 * - Dashboard: genera editor posizione + config globale
 * 
 * DIPENDENZE: Caricare DOPO opzioni-prodotti.js e DOPO finstral-opzioni.js
 * 
 * STRUTTURA:
 *   CAMPI_PRODOTTI.infisso.configGlobale[] → campi per config default progetto
 *   CAMPI_PRODOTTI.infisso.posizione[]     → campi aggiuntivi per singola posizione
 * 
 * Ogni campo ha:
 *   key       - nome campo nel JSON dati
 *   label     - etichetta UI
 *   type      - 'select'|'text'|'number'|'checkbox'|'radio'|'textarea'|'select-dynamic'
 *   options   - fn() che ritorna array opzioni, oppure array statico
 *   allowCustom - true = mostra "Altro..." con input libero
 *   visibleIf - { field, equals|notEquals|fn } per visibilità condizionale
 *   scope     - 'globale'|'posizione'|'entrambi' (default: dal blocco in cui si trova)
 *   group     - raggruppamento visuale (es. 'finstral', 'bancale', 'twin', 'motore')
 *   unit      - unità di misura (es. 'mm')
 *   optgroups - fn() che ritorna opzioni raggruppate [{label, options}]
 *   dependsOn - campo da cui dipendono le opzioni dinamiche
 *   zeroDisables - true = qta=0 disattiva il prodotto
 *   readonly  - true = non editabile (calcolato)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

(function() {
    'use strict';

    if (!window.OPZIONI_PRODOTTI) {
        console.error('❌ campi-prodotti.js: OPZIONI_PRODOTTI non trovato!');
        return;
    }

    const P = window.OPZIONI_PRODOTTI;

    // Helper: opzioni disponibili se un DB esterno è caricato
    const _finstralOpt = (key) => {
        if (typeof FINSTRAL_OPZIONI !== 'undefined' && FINSTRAL_OPZIONI[key]) {
            return FINSTRAL_OPZIONI[key].map(item => item.nome || item.codice || item);
        }
        return [];
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // 🪟 INFISSO
    // ═══════════════════════════════════════════════════════════════════════════

    const INFISSO_CONFIG_GLOBALE = [
        // --- Generali ---
        { key: 'azienda', label: 'Azienda', type: 'select', options: () => P.infissi.aziende, allowCustom: true },

        // --- Finstral specifici ---
        { key: 'tipoAnta', label: 'Tipo Anta', type: 'select', options: () => P.infissi.tipiAnta, allowCustom: true,
          visibleIf: { field: 'azienda', equalsLower: 'finstral' }, group: 'finstral' },

        { key: 'finituraInt', label: 'Finitura Interna', type: 'select', options: () => P.infissi.finiture, allowCustom: true,
          visibleIf: { field: 'azienda', equalsLower: 'finstral' }, group: 'finstral' },

        { key: 'finituraEst', label: 'Finitura Esterna', type: 'select', options: () => P.infissi.finiture, allowCustom: true,
          visibleIf: { field: 'azienda', equalsLower: 'finstral' }, group: 'finstral' },

        { key: 'coloreInt', label: 'Colore Interno', type: 'select-dynamic',
          dependsOn: 'finituraInt', 
          optionsFn: (finitura) => P.getColoriPerFinitura ? P.getColoriPerFinitura(finitura) : [],
          allowCustom: true,
          visibleIf: { field: 'azienda', equalsLower: 'finstral' }, group: 'finstral' },

        { key: 'coloreEst', label: 'Colore Esterno', type: 'select-dynamic',
          dependsOn: 'finituraEst',
          optionsFn: (finitura) => P.getColoriPerFinitura ? P.getColoriPerFinitura(finitura) : [],
          allowCustom: true,
          visibleIf: { field: 'azienda', equalsLower: 'finstral' }, group: 'finstral' },

        { key: 'telaio', label: 'Telaio', type: 'select-dynamic',
          dependsOn: ['finituraInt', 'finituraEst'],
          optionsFn: null, // Richiede getTelaiPerProgetto(project) — logica specifica app
          customGetter: 'getTelaiPerProgetto',
          allowCustom: true,
          visibleIf: { field: 'azienda', equalsLower: 'finstral' }, group: 'finstral' },

        { key: 'allarme', label: 'Allarme', type: 'select', options: () => P.infissi.allarme, allowCustom: true,
          visibleIf: { field: 'azienda', equalsLower: 'finstral' }, group: 'finstral' },

        { key: 'vetro', label: 'Vetro', type: 'select', options: () => P.infissi.vetri, allowCustom: true,
          visibleIf: { field: 'azienda', equalsLower: 'finstral' }, group: 'finstral' },

        { key: 'maniglia', label: 'Maniglia', type: 'select', options: () => P.infissi.maniglie, allowCustom: true,
          visibleIf: { field: 'azienda', equalsLower: 'finstral' }, group: 'finstral' },

        { key: 'coloreManiglia', label: 'Colore Maniglia', type: 'select', options: () => P.infissi.coloriManiglia, allowCustom: true,
          visibleIf: { field: 'azienda', equalsLower: 'finstral' }, group: 'finstral' },

        { key: 'tagliTelaio', label: 'Tagli Telaio', type: 'select', options: () => P.infissi.tagliTelaio, allowCustom: true,
          visibleIf: { field: 'azienda', equalsLower: 'finstral' }, group: 'finstral' },

        // --- Bancale (finstral, opzionale) ---
        { key: 'bancaleTipo', label: 'Bancale Tipo', type: 'select',
          options: () => [
              { value: 'PVC', label: 'PVC (cod.25000) - MDF pellicolato 25mm' },
              { value: 'LEGNO_95000', label: 'Legno 95000 - Profilo 39mm' },
              { value: 'LEGNO_96000', label: 'Legno 96000 - Profilo 69mm' }
          ],
          visibleIf: { field: 'azienda', equalsLower: 'finstral' }, group: 'bancale' },

        { key: 'bancaleBordo', label: 'Bancale Bordo', type: 'select',
          options: () => [
              { value: '0', label: '0 - Arrotondati sui lati' },
              { value: '1', label: '1 - Squadrati sui lati' }
          ],
          visibleIf: { field: 'bancaleTipo', notEmpty: true }, group: 'bancale' },

        { key: 'bancaleProfondita', label: 'Bancale Profondità', type: 'select', unit: 'mm',
          options: () => [120, 150, 180, 200, 240, 280, 320, 360, 400],
          visibleIf: { field: 'bancaleTipo', notEmpty: true }, group: 'bancale' },

        // --- Anta Twin (finstral + tipoAnta contiene 'twin') ---
        { key: 'antaTwinTipo', label: 'Tipo Oscurante', type: 'select',
          options: () => [
              { value: 'veneziana', label: '🪟 Veneziana (lamelle 25mm)' },
              { value: 'plissettata', label: '🎚️ Tenda Plissettata' }
          ],
          visibleIf: { field: 'tipoAnta', containsLower: 'twin' }, group: 'twin' },

        { key: 'antaTwinModello', label: 'Modello Anta Twin', type: 'select-dynamic',
          dependsOn: 'antaTwinTipo',
          customGetter: 'getAntaTwinModelli',  // da FINSTRAL_ANTA_TWIN.tipiAnta
          visibleIf: { field: 'antaTwinTipo', notEmpty: true }, group: 'twin' },

        { key: 'antaTwinColore', label: 'Colore Twin', type: 'select-dynamic',
          dependsOn: 'antaTwinTipo',
          customGetter: 'getAntaTwinColori',  // da FINSTRAL_ANTA_TWIN.colori*
          visibleIf: { field: 'antaTwinTipo', notEmpty: true }, group: 'twin' },

        { key: 'antaTwinComando', label: 'Comando Twin', type: 'select-dynamic',
          customGetter: 'getAntaTwinComandi',  // da FINSTRAL_ANTA_TWIN.comandi
          visibleIf: { field: 'antaTwinTipo', notEmpty: true }, group: 'twin' }
    ];

    const INFISSO_POSIZIONE = [
        { key: 'qta', label: 'Quantità', type: 'select',
          options: () => [0,1,2,3,4,5,6,7,8,9,10], zeroDisables: true },

        { key: 'tipoInfissoAssociato', label: 'Tipo Infisso', type: 'radio',
          options: () => [
              { value: 'F', label: 'F (Finestra)' },
              { value: 'PF', label: 'PF (Porta Finestra)' }
          ]},

        // --- Finstral: Codice Modello con optgroup ---
        { key: 'codiceModello', label: 'Codice Modello', type: 'select',
          optgroups: () => P.codiciModello,  // struttura raggruppata da OPZIONI_PRODOTTI
          optionsFlat: () => P.getCodiciModelloFlat ? P.getCodiciModelloFlat() : [],
          visibleIf: { field: 'azienda', equalsLower: 'finstral' }, group: 'finstral-codici' },

        // --- Ferramenta 1/2/3 ---
        { key: 'ferramenta1', label: 'Ferramenta 1', type: 'select',
          optgroups: () => P.infissi.ferramenta,  // struttura raggruppata
          optionsFlat: () => P.getFerramentaFlat ? P.getFerramentaFlat() : [],
          visibleIf: { field: 'azienda', equalsLower: 'finstral' }, group: 'finstral-codici' },
        { key: 'lato1', label: 'Lato 1', type: 'select',
          optionsFlat: () => P.getLatiDinFlat ? P.getLatiDinFlat() : [],
          visibleIf: { field: 'azienda', equalsLower: 'finstral' }, group: 'finstral-codici' },
        { key: 'esecuzione1', label: 'Esecuzione 1', type: 'select',
          optionsFlat: () => P.getEsecuzioniFlat ? P.getEsecuzioniFlat() : [],
          visibleIf: { field: 'azienda', equalsLower: 'finstral' }, group: 'finstral-codici' },

        { key: 'ferramenta2', label: 'Ferramenta 2', type: 'select',
          optgroups: () => P.infissi.ferramenta,
          optionsFlat: () => P.getFerramentaFlat ? P.getFerramentaFlat() : [],
          visibleIf: { field: 'azienda', equalsLower: 'finstral' }, group: 'finstral-codici' },
        { key: 'lato2', label: 'Lato 2', type: 'select',
          optionsFlat: () => P.getLatiDinFlat ? P.getLatiDinFlat() : [],
          visibleIf: { field: 'azienda', equalsLower: 'finstral' }, group: 'finstral-codici' },
        { key: 'esecuzione2', label: 'Esecuzione 2', type: 'select',
          optionsFlat: () => P.getEsecuzioniFlat ? P.getEsecuzioniFlat() : [],
          visibleIf: { field: 'azienda', equalsLower: 'finstral' }, group: 'finstral-codici' },

        { key: 'ferramenta3', label: 'Ferramenta 3', type: 'select',
          optgroups: () => P.infissi.ferramenta,
          optionsFlat: () => P.getFerramentaFlat ? P.getFerramentaFlat() : [],
          visibleIf: { field: 'azienda', equalsLower: 'finstral' }, group: 'finstral-codici' },
        { key: 'lato3', label: 'Lato 3', type: 'select',
          optionsFlat: () => P.getLatiDinFlat ? P.getLatiDinFlat() : [],
          visibleIf: { field: 'azienda', equalsLower: 'finstral' }, group: 'finstral-codici' },
        { key: 'esecuzione3', label: 'Esecuzione 3', type: 'select',
          optionsFlat: () => P.getEsecuzioniFlat ? P.getEsecuzioniFlat() : [],
          visibleIf: { field: 'azienda', equalsLower: 'finstral' }, group: 'finstral-codici' },

        // --- FINslide (solo se codiceModello è tipo scorrevole) ---
        { key: 'finslideTelaio', label: 'FINslide Telaio', type: 'select',
          customGetter: 'getFinslideOptions', 
          visibleIf: { field: 'codiceModello', fn: (v) => v && String(v).startsWith('5') }, group: 'finslide' },
        { key: 'finslideAnta', label: 'FINslide Anta', type: 'select',
          customGetter: 'getFinslideOptions',
          visibleIf: { field: 'codiceModello', fn: (v) => v && String(v).startsWith('5') }, group: 'finslide' },
        { key: 'finslideFerramenta', label: 'FINslide Ferramenta', type: 'select',
          customGetter: 'getFinslideOptions',
          visibleIf: { field: 'codiceModello', fn: (v) => v && String(v).startsWith('5') }, group: 'finslide' },
        { key: 'finslideManiglia', label: 'FINslide Maniglia', type: 'select',
          customGetter: 'getFinslideOptions',
          visibleIf: { field: 'codiceModello', fn: (v) => v && String(v).startsWith('5') }, group: 'finslide' },
        { key: 'finslideColoreManiglia', label: 'FINslide Col. Maniglia', type: 'select',
          customGetter: 'getFinslideOptions',
          visibleIf: { field: 'codiceModello', fn: (v) => v && String(v).startsWith('5') }, group: 'finslide' },
        { key: 'finslideVetro', label: 'FINslide Vetro', type: 'select',
          customGetter: 'getFinslideOptions',
          visibleIf: { field: 'codiceModello', fn: (v) => v && String(v).startsWith('5') }, group: 'finslide' },

        // --- BRM ---
        { key: 'BRM_L', label: 'BRM Larghezza', type: 'number', unit: 'mm', readonly: false },
        { key: 'BRM_H', label: 'BRM Altezza', type: 'number', unit: 'mm', readonly: false },

        { key: 'note', label: 'Note Infisso', type: 'textarea' }
    ];

    // ═══════════════════════════════════════════════════════════════════════════
    // 🚪 PERSIANA
    // ═══════════════════════════════════════════════════════════════════════════

    const PERSIANA_CONFIG_GLOBALE = [
        { key: 'azienda', label: 'Azienda', type: 'select', options: () => P.persiane.aziende, allowCustom: true },
        { key: 'modello', label: 'Modello', type: 'select', options: () => P.persiane.modelli, allowCustom: true },
        { key: 'fissaggio', label: 'Fissaggio', type: 'select', options: () => P.persiane.fissaggi, allowCustom: true },
        { key: 'tipoTelaio', label: 'Tipo Telaio', type: 'select', options: () => P.persiane.tipiTelaio, allowCustom: true,
          visibleIf: { field: 'fissaggio', equals: 'telaio' } },
        { key: 'colorePersiana', label: 'Colore Persiana', type: 'select',
          customGetter: 'getColoriPersiane', allowCustom: true },
        { key: 'coloreTelaio', label: 'Colore Telaio', type: 'select',
          customGetter: 'getColoriPersiane', allowCustom: true,
          visibleIf: { field: 'fissaggio', equals: 'telaio' } },
        { key: 'battuta', label: 'Battuta', type: 'select', options: () => P.persiane.battute, allowCustom: true }
    ];

    const PERSIANA_POSIZIONE = [
        { key: 'qta', label: 'Quantità', type: 'select',
          options: () => [0,1,2,3,4,5,6,7,8,9,10], zeroDisables: true },
        { key: 'tipo', label: 'Tipo', type: 'select', options: () => P.persiane.tipi },
        { key: 'apertura', label: 'Apertura', type: 'select', options: () => P.persiane.aperture },

        // Link ad altri prodotti
        { key: 'tapparella', label: 'Collega Tapparella', type: 'checkbox', group: 'link-prodotti' },
        { key: 'zanzariera', label: 'Collega Zanzariera', type: 'checkbox', group: 'link-prodotti' },

        // BRM
        { key: 'BRM_L', label: 'BRM Larghezza', type: 'number', unit: 'mm', readonly: false },
        { key: 'BRM_H', label: 'BRM Altezza', type: 'number', unit: 'mm', readonly: false },

        { key: 'note', label: 'Note Persiana', type: 'textarea' }
    ];

    // ═══════════════════════════════════════════════════════════════════════════
    // 🎚️ TAPPARELLA
    // ═══════════════════════════════════════════════════════════════════════════

    const TAPPARELLA_CONFIG_GLOBALE = [
        // Checkbox "cosa serve"
        { key: 'serveTapparella', label: 'Tapparella nuova', type: 'checkbox', default: true, group: 'cosa-serve' },
        { key: 'serveMotore', label: 'Motore', type: 'checkbox', default: false, group: 'cosa-serve' },
        { key: 'serveAccessori', label: 'Accessori', type: 'checkbox', default: false, group: 'cosa-serve' },

        // Config tapparella (solo se serveTapparella)
        { key: 'azienda', label: 'Azienda', type: 'select', options: () => P.tapparelle.aziende, allowCustom: true,
          visibleIf: { field: 'serveTapparella', equals: true }, group: 'tapparella' },
        { key: 'modello', label: 'Modello', type: 'select-dynamic',
          dependsOn: 'azienda',
          optionsFn: (azienda) => P.getModelliTapparellaOptions ? P.getModelliTapparellaOptions(azienda) : [],
          visibleIf: { field: 'serveTapparella', equals: true }, group: 'tapparella' },
        { key: 'colore', label: 'Colore Telo', type: 'select-dynamic',
          dependsOn: 'modello',
          optionsFn: (modello) => P.getColoriTapparella ? P.getColoriTapparella(modello) : [],
          visibleIf: { field: 'serveTapparella', equals: true }, group: 'tapparella' },
        { key: 'guida', label: 'Guida', type: 'select', options: () => P.tapparelle.guide,
          visibleIf: { field: 'serveTapparella', equals: true }, group: 'tapparella' },
        { key: 'coloreGuida', label: 'Colore Guida', type: 'select',
          options: () => P.getColoriGuide ? P.getColoriGuide() : [],
          visibleIf: { field: 'serveTapparella', equals: true }, group: 'tapparella' },

        // Config motore (solo se serveMotore)
        { key: 'motoreModelloDefault', label: 'Modello Motore', type: 'select',
          options: () => P.motori.modelli,
          optionLabel: (m) => `${m.modello} - €${m.prezzo.toFixed(2)}`,
          optionValue: (m) => m.id,
          visibleIf: { field: 'serveMotore', equals: true }, group: 'motore' },
        { key: 'comandoDefault', label: 'Comando', type: 'select',
          options: () => P.motori.comandi,
          optionLabel: (c) => `${c.nome} - €${c.prezzo.toFixed(2)}`,
          optionValue: (c) => c.id,
          visibleIf: { field: 'serveMotore', equals: true }, group: 'motore' },
        { key: 'accessoriMotoreDefault', label: 'Accessori Motore', type: 'multi-checkbox',
          options: () => P.motori.accessori,
          optionLabel: (a) => `${a.nome} €${a.prezzo.toFixed(2)}`,
          optionValue: (a) => a.id,
          visibleIf: { field: 'serveMotore', equals: true }, group: 'motore' }
    ];

    const TAPPARELLA_POSIZIONE = [
        // Checkbox cosa serve (override da globale)
        { key: 'serveTapparella', label: 'Tapparella nuova', type: 'checkbox', group: 'cosa-serve' },
        { key: 'serveMotore', label: 'Motore', type: 'checkbox', group: 'cosa-serve' },
        { key: 'serveAccessori', label: 'Accessori', type: 'checkbox', group: 'cosa-serve' },

        { key: 'qta', label: 'Quantità', type: 'select',
          options: () => [0,1,2,3,4,5,6,7,8,9,10], zeroDisables: true },

        { key: 'tapparellaEsistente', label: 'Tapparella Esistente', type: 'checkbox', group: 'sostituzione' },
        { key: 'accessoriDaSostituire', label: 'Accessori da Sostituire', type: 'multi-checkbox',
          options: () => P.tapparelle.accessoriManuali,
          group: 'sostituzione' },

        // Link prodotti
        { key: 'cassonetto', label: 'Collega Cassonetto', type: 'checkbox', group: 'link-prodotti' },
        { key: 'zanzariera', label: 'Collega Zanzariera', type: 'checkbox', group: 'link-prodotti' },

        // BRM
        { key: 'BRM_L', label: 'BRM Larghezza', type: 'number', unit: 'mm', readonly: false },
        { key: 'BRM_H', label: 'BRM Altezza', type: 'number', unit: 'mm', readonly: false },

        { key: 'note', label: 'Note Tapparella', type: 'textarea' }
    ];

    // ═══════════════════════════════════════════════════════════════════════════
    // 🦟 ZANZARIERA
    // ═══════════════════════════════════════════════════════════════════════════

    const ZANZARIERA_CONFIG_GLOBALE = [
        { key: 'azienda', label: 'Azienda', type: 'select', options: () => P.zanzariere.aziende, allowCustom: true },

        // --- Palagina specifici ---
        { key: 'lineaF', label: 'Linea Finestre', type: 'select-dynamic',
          customGetter: 'getPalaginaLinee',
          visibleIf: { field: 'azienda', equals: 'Palagina' }, group: 'palagina' },
        { key: 'modelloF', label: 'Modello Finestre', type: 'select-dynamic',
          dependsOn: 'lineaF',
          customGetter: 'getPalaginaModelli',
          visibleIf: { field: 'lineaF', notEmpty: true }, group: 'palagina' },
        { key: 'lineaPF', label: 'Linea Porte-Finestre', type: 'select-dynamic',
          customGetter: 'getPalaginaLinee',
          visibleIf: { field: 'azienda', equals: 'Palagina' }, group: 'palagina' },
        { key: 'modelloPF', label: 'Modello Porte-Finestre', type: 'select-dynamic',
          dependsOn: 'lineaPF',
          customGetter: 'getPalaginaModelli',
          visibleIf: { field: 'lineaPF', notEmpty: true }, group: 'palagina' },

        // Palagina: fascia colore → colore telaio (dipendente)
        { key: 'fasciaColore', label: 'Fascia Colore', type: 'select',
          options: () => [
              { value: 'F1', label: 'Fascia 1 (Base)' },
              { value: 'F2', label: 'Fascia 2 (Intermedia)' },
              { value: 'F3', label: 'Fascia 3 (Premium)' }
          ],
          visibleIf: { field: 'azienda', equals: 'Palagina' }, group: 'palagina' },
        { key: 'coloreTelaio', label: 'Colore Telaio', type: 'select-dynamic',
          dependsOn: 'fasciaColore',
          customGetter: 'getPalaginaColori',
          visibleIf: { field: 'fasciaColore', notEmpty: true }, group: 'palagina' },
        { key: 'tipoRete', label: 'Tipo Rete', type: 'select-dynamic',
          customGetter: 'getPalaginaReti',
          visibleIf: { field: 'azienda', equals: 'Palagina' }, group: 'palagina' },
        { key: 'colorePlastica', label: 'Colore Plastica', type: 'select-dynamic',
          customGetter: 'getPalaginaColoriPlastica',
          visibleIf: { field: 'azienda', equals: 'Palagina' }, group: 'palagina' },

        // --- Non-Palagina generici ---
        { key: 'tipo', label: 'Tipo Zanzariera', type: 'select',
          options: () => ['Avvolgibile', 'Plissé', 'Battente', 'Scorrevole', 'Fissa'],
          visibleIf: { field: 'azienda', notEquals: 'Palagina' }, group: 'generico' },
        { key: 'coloreTelaio', label: 'Colore Telaio', type: 'text',
          visibleIf: { field: 'azienda', notEquals: 'Palagina' }, group: 'generico',
          keyOverride: 'coloreTelaioGenerico' },
        { key: 'tipoRete', label: 'Tipo Rete', type: 'select',
          options: () => ['Standard', 'Anti-polline', 'Pet-resistant', 'Micro-forata'],
          visibleIf: { field: 'azienda', notEquals: 'Palagina' }, group: 'generico',
          keyOverride: 'tipoReteGenerico' }
    ];

    const ZANZARIERA_POSIZIONE = [
        { key: 'qta', label: 'Quantità', type: 'select',
          options: () => [0,1,2,3,4,5,6,7,8,9,10], zeroDisables: true },
        { key: 'linea', label: 'Linea', type: 'select-dynamic', customGetter: 'getPalaginaLinee' },
        { key: 'modello', label: 'Modello', type: 'select-dynamic',
          dependsOn: 'linea', customGetter: 'getPalaginaModelli' },
        { key: 'fasciaColore', label: 'Fascia Colore', type: 'select',
          options: () => P.zanzariere.fasceColore },
        { key: 'coloreTelaio', label: 'Colore Telaio', type: 'select',
          options: () => P.zanzariere.coloriTelaio },
        { key: 'tipoRete', label: 'Tipo Rete', type: 'select', options: () => P.zanzariere.tipiRete },
        { key: 'colorePlastica', label: 'Colore Plastica', type: 'text' },

        // Link prodotti
        { key: 'cassonetto', label: 'Collega Cassonetto', type: 'checkbox', group: 'link-prodotti' },
        { key: 'tapparella', label: 'Collega Tapparella', type: 'checkbox', group: 'link-prodotti' },

        // BRM
        { key: 'BRM_L', label: 'BRM Larghezza', type: 'number', unit: 'mm', readonly: false },
        { key: 'BRM_H', label: 'BRM Altezza', type: 'number', unit: 'mm', readonly: false },

        { key: 'note', label: 'Note Zanzariera', type: 'textarea' }
    ];

    // ═══════════════════════════════════════════════════════════════════════════
    // 📦 CASSONETTO
    // ═══════════════════════════════════════════════════════════════════════════

    const CASSONETTO_CONFIG_GLOBALE = [
        { key: 'azienda', label: 'Azienda', type: 'select', options: () => P.cassonetti.aziende, allowCustom: true },
        { key: 'tipo', label: 'Tipo', type: 'select', options: () => P.cassonetti.tipi },
        { key: 'materialeCass', label: 'Materiale', type: 'select', options: () => P.cassonetti.materiali },
        { key: 'codiceCass', label: 'Codice Cassonetto', type: 'select-dynamic',
          dependsOn: 'materialeCass',
          optionsFn: (mat) => {
              if (mat === 'PVC') return P.cassonetti.codiciPVC.map(c => c.desc || c.nome);
              if (mat === 'Legno') return P.cassonetti.codiciLegno.map(c => c.desc || c.nome);
              return [...P.cassonetti.codiciPVC.map(c => c.desc || c.nome), ...P.cassonetti.codiciLegno.map(c => c.desc || c.nome)];
          }},
        { key: 'finitura', label: 'Finitura', type: 'select',
          options: () => ['PVC', 'Alluminio', 'Legno'] },
        { key: 'coloreDaInfisso', label: 'Colore = da Infisso', type: 'checkbox' },
        { key: 'gruppoColoreCass', label: 'Gruppo Colore', type: 'text',
          visibleIf: { field: 'coloreDaInfisso', notEquals: true } },
        { key: 'coloreCass', label: 'Colore Cassonetto', type: 'text',
          visibleIf: { field: 'coloreDaInfisso', notEquals: true } },
        { key: 'codiceIsolamento', label: 'Codice Isolamento', type: 'text' },
        { key: 'posa', label: 'Posa', type: 'select', options: () => ['a muro', 'in luce'] },
        { key: 'aSoffitto', label: 'A Soffitto', type: 'checkbox' }
    ];

    const CASSONETTO_POSIZIONE = [
        { key: 'qta', label: 'Quantità', type: 'select',
          options: () => [0,1,2,3,4,5,6,7,8,9,10], zeroDisables: true },

        // Misure specifiche cassonetto
        { key: 'LS', label: 'LS', type: 'number', unit: 'mm', group: 'misure-cass' },
        { key: 'SRSX', label: 'SRSX', type: 'number', unit: 'mm', group: 'misure-cass' },
        { key: 'SRDX', label: 'SRDX', type: 'number', unit: 'mm', group: 'misure-cass' },
        { key: 'ZSX', label: 'ZSX', type: 'number', unit: 'mm', group: 'misure-cass' },
        { key: 'ZDX', label: 'ZDX', type: 'number', unit: 'mm', group: 'misure-cass' },
        { key: 'HCASS', label: 'HCASS', type: 'number', unit: 'mm', group: 'misure-cass' },
        { key: 'B', label: 'B', type: 'number', unit: 'mm', group: 'misure-cass' },
        { key: 'C', label: 'C', type: 'number', unit: 'mm', group: 'misure-cass' },
        { key: 'BSuperiore', label: 'B Superiore', type: 'number', unit: 'mm', group: 'misure-cass' },

        // BRM
        { key: 'BRM_L', label: 'BRM Larghezza', type: 'number', unit: 'mm', readonly: false },
        { key: 'BRM_H', label: 'BRM Altezza', type: 'number', unit: 'mm', readonly: false },

        { key: 'note', label: 'Note Cassonetto', type: 'textarea' }
    ];

    // ═══════════════════════════════════════════════════════════════════════════
    // 📦 EXPORT
    // ═══════════════════════════════════════════════════════════════════════════

    window.CAMPI_PRODOTTI = {
        version: '1.0.0',

        infisso: {
            configGlobale: INFISSO_CONFIG_GLOBALE,
            posizione: INFISSO_POSIZIONE,
            configKey: 'configInfissi',       // key nel project JSON
            productKey: 'infisso',             // key nella posizione
            prodottiKey: 'infissi',            // key in project.prodotti
            icon: '🪟',
            label: 'Infissi'
        },

        persiana: {
            configGlobale: PERSIANA_CONFIG_GLOBALE,
            posizione: PERSIANA_POSIZIONE,
            configKey: 'configPersiane',
            productKey: 'persiana',
            prodottiKey: 'persiane',
            icon: '🚪',
            label: 'Persiane'
        },

        tapparella: {
            configGlobale: TAPPARELLA_CONFIG_GLOBALE,
            posizione: TAPPARELLA_POSIZIONE,
            configKey: 'configTapparelle',
            productKey: 'tapparella',
            prodottiKey: 'tapparelle',
            icon: '🎚️',
            label: 'Tapparelle'
        },

        zanzariera: {
            configGlobale: ZANZARIERA_CONFIG_GLOBALE,
            posizione: ZANZARIERA_POSIZIONE,
            configKey: 'configZanzariere',
            productKey: 'zanzariera',
            prodottiKey: 'zanzariere',
            icon: '🦟',
            label: 'Zanzariere'
        },

        cassonetto: {
            configGlobale: CASSONETTO_CONFIG_GLOBALE,
            posizione: CASSONETTO_POSIZIONE,
            configKey: 'configCassonetti',
            productKey: 'cassonetto',
            prodottiKey: 'cassonetti',
            icon: '📦',
            label: 'Cassonetti'
        },

        // ═══════════════════════════════════════════════════════════════════
        // 🔧 UTILITY: valuta visibleIf
        // ═══════════════════════════════════════════════════════════════════
        isVisible(campo, dati) {
            if (!campo.visibleIf) return true;
            const v = campo.visibleIf;
            const val = dati?.[v.field];

            if (v.equals !== undefined) return val === v.equals;
            if (v.notEquals !== undefined) return val !== v.equals;
            if (v.equalsLower !== undefined) return String(val || '').toLowerCase() === v.equalsLower;
            if (v.containsLower !== undefined) return String(val || '').toLowerCase().includes(v.containsLower);
            if (v.notEmpty !== undefined) return !!val && val !== '';
            if (v.fn) return v.fn(val);
            return true;
        },

        // ═══════════════════════════════════════════════════════════════════
        // 🔧 UTILITY: ottieni opzioni per un campo
        // ═══════════════════════════════════════════════════════════════════
        getOptions(campo, dati) {
            // select-dynamic con optionsFn
            if (campo.optionsFn && campo.dependsOn) {
                const depVal = typeof campo.dependsOn === 'string' 
                    ? dati?.[campo.dependsOn] 
                    : campo.dependsOn.map(d => dati?.[d]);
                return campo.optionsFn(depVal) || [];
            }
            // options statico o getter
            if (campo.options) {
                return typeof campo.options === 'function' ? campo.options() : campo.options;
            }
            // optionsFlat (per campi con optgroups)
            if (campo.optionsFlat) {
                return typeof campo.optionsFlat === 'function' ? campo.optionsFlat() : campo.optionsFlat;
            }
            return [];
        },

        // ═══════════════════════════════════════════════════════════════════
        // 🔧 UTILITY: tutti i campi per un prodotto (globale + posizione uniti)
        // ═══════════════════════════════════════════════════════════════════
        getAllFields(prodotto) {
            const def = this[prodotto];
            if (!def) return [];
            // configGlobale + posizione, senza duplicati per key
            const keys = new Set();
            const result = [];
            for (const campo of def.configGlobale) {
                keys.add(campo.key);
                result.push({ ...campo, _source: 'globale' });
            }
            for (const campo of def.posizione) {
                if (!keys.has(campo.key)) {
                    result.push({ ...campo, _source: 'posizione' });
                }
            }
            return result;
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // 📊 STATISTICHE
    // ═══════════════════════════════════════════════════════════════════════════
    const stats = {};
    for (const [key, val] of Object.entries(window.CAMPI_PRODOTTI)) {
        if (val.configGlobale) {
            stats[key] = {
                globale: val.configGlobale.length,
                posizione: val.posizione.length,
                totale: val.configGlobale.length + val.posizione.length
            };
        }
    }
    console.log('✅ campi-prodotti.js v1.0.0 caricato', stats);

})();
