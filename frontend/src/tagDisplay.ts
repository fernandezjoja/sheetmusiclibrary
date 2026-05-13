/**
 * Display-label map for namespaced tags.
 *
 * Convention:
 *  - Namespace prefixes (`service:`, `context:`, etc.) stay in English — they
 *    are stable identifiers, not user-facing strings.
 *  - Tag values (after the colon) are Spanish, ASCII-only, hyphenated. E.g.
 *    `context:natividad-senor`, `context:dormicion`, `slot:himno-querubico`.
 *  - Display labels (the right-hand side) are full Spanish with diacritics.
 *
 * Anything missing falls back to a generic title-cased rendering of the raw
 * value — so a new tag value is never "broken" in the UI, just less polished
 * until it's added here.
 *
 * Add new entries alphabetically within each namespace block to keep diffs
 * small.
 *
 * Special cases handled in tags.ts (not here):
 *  - `tone:N`  → "Tono N" (N is numeric, doesn't belong in a fixed map).
 *  - `context:default` → hidden entirely (the un-marked "ordinary" case).
 *  - `order:N` → hidden (purely a sort key).
 */
export const TAG_DISPLAY: Record<string, string> = {
  // ---- service: --------------------------------------------------------
  'service:acatisto': 'Acatisto',
  'service:bautismo': 'Bautismo',
  'service:matrimonio': 'Matrimonio',
  'service:completas': 'Completas',
  'service:funeral': 'Funeral',
  'service:himno-theotokos': 'Himno a la Theotokos',
  'service:horas': 'Horas',
  'service:contaquio': 'Contaquio',
  'service:divina-liturgia': 'Divina Liturgia',
  'service:maitines': 'Maitines',
  'service:moleben': 'Moleben',
  'service:panikhida': 'Panikhida',
  'service:tropario': 'Tropario',
  'service:uncion': 'Unción',
  'service:visperas': 'Vísperas',

  // ---- slot: -----------------------------------------------------------
  'slot:primera-antifona': 'Primera Antífona',
  'slot:segunda-antifona': 'Segunda Antífona',
  'slot:tercera-antifona': 'Tercera Antífona',
  'slot:bienaventuranzas': 'Bienaventuranzas',
  'slot:venid-adoremos': 'Venid, Adoremos',
  'slot:trisagio': 'Trisagio',
  'slot:himno-querubico': 'Himno Querúbico',
  'slot:himno-victoria': 'Himno de Victoria',
  'slot:cantamoste': 'Cantámoste',
  'slot:himno-theotokos': 'Himno a la Theotokos',
  'slot:uno-es-santo': 'Uno Es Santo',
  'slot:himno-pre-comunion': 'Himno Antes de Comunión',
  'slot:hemos-visto': 'Hemos Visto La Verdadera Luz',
  'slot:llenese-nuestra-boca': 'Llénese Nuestra Boca',



  'slot:aleluya': 'Aleluya',
  'slot:prokimeno': 'Proquímeno',


  'slot:ahora-despides': 'Ahora Despides',
  'slot:apolitikios': 'Apolitikios',
  'slot:bienaventurado-varon': 'Bienaventurado el Varón',
  'slot:credo': 'Credo',
  'slot:letania-suplica': 'Letanía de Súplica',
  'slot:luz-gozosa': 'Luz Gozosa',
  'slot:padre-nuestro': 'Padre Nuestro',
  'slot:pequena-entrada': 'Pequeña Entrada',
  'slot:salmo-103': 'Salmo 103',
  'slot:salmo-140': 'Salmo 140',
  'slot:troparios': 'Troparios',
  'slot:verso-comunion': 'Verso de Comunión',

  // ---- context: (default is hidden — see tags.ts) ----------------------
  'context:natividad-theotokos': 'Natividad de la Theotokos',
  'context:exaltacion-cruz': 'Exaltación de la Cruz',
  'context:presentacion-theotokos': 'Presentación de la Theotokos',
  'context:natividad-senor': 'Natividad del Señor',
  'context:teofania': 'Teofanía',
  'context:encuentro-senor': 'Encuentro del Señor',
  'context:anunciacion': 'Anunciación',
  'context:domingo-de-ramos': 'Domingo de Ramos',
  'context:ascension': 'Ascensión',
  'context:pentecostes': 'Pentecostés',
  'context:transfiguracion': 'Transfiguración',
  'context:dormicion': 'Dormición de la Theotokos',
  'context:pascua': 'Pascua',

  'context:cuaresma': 'Cuaresma',
  'context:liturgia-basilio': 'Liturgia de San Basilio',
  'context:sabado-lazaro': 'Sábado de Lázaro',
  'context:sabado-santo': 'Sábado Santo',

  // ---- liturgy-type: ---------------------------------------------------
  'liturgy-type:basilio': 'San Basilio',
  'liturgy-type:crisostomo': 'San Juan Crisóstomo',
  'liturgy-type:pre-santificados': 'Pre-Santificados',

  // ---- chant: ----------------------------------------------------------
  'chant:alaska': 'Alaska',
  'chant:bizantino': 'Bizantino',
  'chant:bulgaro': 'Búlgaro',
  'chant:carpato-ruso': 'Carpato-Ruso',
  'chant:galiciano': 'Galiciano',
  'chant:griego': 'Griego',
  'chant:kievan': 'Kievan',
  'chant:obijod': 'Obikhod',
  'chant:optina': 'Optina',
  'chant:pochaev': 'Pochaev',
  'chant:psaltico': 'Psáltico',
  'chant:valaam': 'Valaam',
  'chant:znamenny-mayor': 'Znamenny Mayor',
  'chant:znamenny-menor': 'Znamenny Menor',

  // ---- language: -------------------------------------------------------
  'language:eslavo': 'Eslavo Eclesiástico',
  'language:espanol': 'Español',
  'language:griego': 'Griego',
  'language:ingles': 'Inglés',
  'language:rumano': 'Rumano',
  'language:serbio': 'Serbio',

  // ---- voicing: (acronyms kept; descriptive variants in Spanish) -------
  'voicing:al-unisono': 'Al unísono',
  'voicing:dos-voces': 'A dos voces',
  'voicing:sab': 'SAB',
  'voicing:satb': 'SATB',
  'voicing:ssaa': 'SSAA',
  'voicing:ttbb': 'TTBB',

  // ---- cycle: (transliterated Greek terms, kept as-is) -----------------
  'cycle:menaion': 'Menaion',
  'cycle:octoechos': 'Octoechos',
  'cycle:pentecostarion': 'Pentecostarion',
  'cycle:triodion': 'Triodion',

  // ---- feast-rank: -----------------------------------------------------
  'feast-rank:fiesta-mayor': 'Fiesta Mayor',
  'feast-rank:fiesta-menor': 'Fiesta Menor',
  'feast-rank:gran-fiesta': 'Gran Fiesta',
  'feast-rank:menor': 'Menor',

  // ---- day-of-week: ----------------------------------------------------
  'day-of-week:domingo': 'Domingo',
  'day-of-week:jueves': 'Jueves',
  'day-of-week:lunes': 'Lunes',
  'day-of-week:martes': 'Martes',
  'day-of-week:miercoles': 'Miércoles',
  'day-of-week:sabado': 'Sábado',
  'day-of-week:viernes': 'Viernes',
}

/** Prefixes whose tags are sorting metadata only — never shown in the UI. */
const HIDDEN_PREFIXES = ['order:']

/** Specific tags hidden because they represent the "un-marked" default case. */
const HIDDEN_TAGS = new Set(['context:default'])

export function isTagHidden(tag: string): boolean {
  if (HIDDEN_TAGS.has(tag)) return true
  return HIDDEN_PREFIXES.some((p) => tag.startsWith(p))
}
