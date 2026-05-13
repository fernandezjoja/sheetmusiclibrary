type Props = {
  onAdd: (tag: string) => void
}

type Section = {
  title: string
  tags: string[]
  note?: string
}

/**
 * Values shown to the admin while uploading. Tracks the conventions actually
 * used in the DB (Spanish ASCII keys, with the few legacy English ones still
 * present like `liturgy-type:chrysostom` and `context:ascension`) plus
 * reasonable extensions for tag values you'll likely add soon.
 *
 * To audit what's actually in the DB:
 *   SELECT split_part(tag, ':', 1) AS namespace, tag, COUNT(*)
 *   FROM (SELECT unnest(tags) AS tag FROM scores) t
 *   GROUP BY tag ORDER BY namespace, tag;
 */
const REQUIRED_SECTIONS: Section[] = [
  {
    title: 'service: (siempre requerido)',
    tags: [
      'service:divina-liturgia',
      'service:visperas',
      'service:maitines',
      'service:completas',
      'service:horas',
      'service:funeral',
      'service:panikhida',
      'service:moleben',
      'service:acatista',
      'service:boda',
      'service:bautismo',
      'service:uncion',
      'service:tropario',
      'service:contaquio',
      'service:himno-theotokos',
    ],
    note: 'Se pueden agregar varios — p.ej. service:funeral + service:panikhida',
  },
  {
    title: 'language: (siempre requerido)',
    tags: [
      'language:espanol',
      'language:ingles',
      'language:eslavo',
      'language:griego',
      'language:rumano',
      'language:serbio',
    ],
  },
  {
    title: 'voicing: (siempre requerido)',
    tags: [
      'voicing:satb',
      'voicing:sab',
      'voicing:ttbb',
      'voicing:ssaa',
      'voicing:al-unisono',
      'voicing:dos-voces',
    ],
  },
]

const APPLICABLE_SECTIONS: Section[] = [
  {
    title: 'slot: (cuando la pieza tiene un rol litúrgico fijo)',
    tags: [
      // Divina Liturgia
      'slot:primera-antifona',
      'slot:segunda-antifona',
      'slot:tercera-antifona',
      'slot:bienaventuranzas',
      'slot:pequena-entrada',
      'slot:venid-adoremos',
      'slot:trisagio',
      'slot:proquimeno',
      'slot:aleluya',
      'slot:himno-querubico',
      'slot:credo',
      'slot:himno-victoria',
      'slot:te-cantamos',
      'slot:himno-theotokos',
      'slot:padre-nuestro',
      'slot:uno-es-santo',
      'slot:verso-comunion',
      'slot:hemos-visto',
      // Vísperas / Maitines
      'slot:salmo-103',
      'slot:salmo-140',
      'slot:dogmatico',
      'slot:luz-gozosa',
      'slot:ahora-despides',
      'slot:apolitikios',
      // Canon (Maitines, Panikhida, Funeral)
      'slot:canon',
    ],
  },
  {
    title: 'order: (cuando se define slot)',
    tags: [
      'order:010',
      'order:020',
      'order:030',
      'order:040',
      'order:050',
      'order:060',
      'order:070',
      'order:080',
      'order:090',
      'order:100',
      'order:110',
      'order:120',
      'order:130',
      'order:140',
      'order:150',
    ],
    note:
      '3 dígitos, múltiplos de 10 (deja hueco para insertar más adelante — p.ej. order:063 entre 060 y 070).',
  },
  {
    title: 'context: (cuando se define slot, o para pieza de fiesta/feast)',
    tags: [
      'context:default',
      'context:natividad-theotokos',
      'context:exaltacion-cruz',
      'context:presentacion-theotokos',
      'context:natividad-senor',
      'context:teofania',
      'context:encuentro-senor',
      'context:anunciacion',
      'context:domingo-de-ramos',
      'context:ascension',
      'context:pentecostes',
      'context:transfiguracion',
      'context:dormicion',
      'context:pascua',
      'context:cuaresma',
      'context:liturgia-basilio',
      'context:sabado-lazaro',
      'context:sabado-santo',
    ],
    note: 'Se pueden agregar varios — para piezas usadas en varias fiestas.',
  },
  {
    title: 'liturgy-type: (cuando service:divina-liturgia)',
    tags: [
      'liturgy-type:san-juan-crisostomo',
      'liturgy-type:san-basilio',
      'liturgy-type:dones-presantificados',
    ],
  },
  {
    title: 'tone: (cuando la pieza tiene tono, cíclico o fijo)',
    tags: [
      'tone:1',
      'tone:2',
      'tone:3',
      'tone:4',
      'tone:5',
      'tone:6',
      'tone:7',
      'tone:8',
    ],
  },
  {
    title: 'cycle: (para piezas del ciclo dominical / temporal)',
    tags: [
      'cycle:octoechos',
      'cycle:menaion',
      'cycle:triodion',
      'cycle:pentecostarion',
    ],
  },
  {
    title: 'chant: (estilo específico, cuando se conoce)',
    tags: [
      'chant:obikhod',
      'chant:kievan',
      'chant:znamenny-menor',
      'chant:znamenny-mayor',
      'chant:optina',
      'chant:valaam',
      'chant:alaska',
      'chant:carpato-ruso',
      'chant:bulgaro',
      'chant:griego',
      'chant:galiciano',
      'chant:pochaev',
      'chant:bizantino',
      'chant:psaltico',
    ],
  },
]

const chipStyle: React.CSSProperties = {
  padding: '2px 8px',
  fontSize: '0.75rem',
  fontFamily: 'var(--mono)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  background: 'var(--bg)',
  color: 'var(--text-h)',
  cursor: 'pointer',
  font: 'inherit',
}

const noteStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--text)',
  fontStyle: 'italic',
  marginTop: 2,
}

function SectionGroup({
  section,
  onAdd,
}: {
  section: Section
  onAdd: (t: string) => void
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>
        {section.title}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {section.tags.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onAdd(t)}
            style={chipStyle}
            title={`Añadir ${t}`}
          >
            {t}
          </button>
        ))}
      </div>
      {section.note && <div style={noteStyle}>{section.note}</div>}
    </div>
  )
}

export default function TagReference({ onAdd }: Props) {
  return (
    <details
      style={{
        marginTop: 4,
        border: '1px solid var(--border)',
        borderRadius: 4,
        padding: '8px 12px',
        background: 'var(--code-bg)',
      }}
    >
      <summary style={{ cursor: 'pointer', fontSize: '0.9rem' }}>
        Etiquetas sugeridas{' '}
        <span style={{ color: 'var(--text)', fontWeight: 'normal' }}>
          (haz clic en una etiqueta para agregarla)
        </span>
      </summary>
      <div style={{ marginTop: 12 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text)', marginBottom: 8 }}>
            Requerido en cada subida:
          </div>
          {REQUIRED_SECTIONS.map((s) => (
            <SectionGroup key={s.title} section={s} onAdd={onAdd} />
          ))}
        </div>
        <div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text)', marginBottom: 8 }}>
            Incluir cuando aplique:
          </div>
          {APPLICABLE_SECTIONS.map((s) => (
            <SectionGroup key={s.title} section={s} onAdd={onAdd} />
          ))}
        </div>
        <div style={{ ...noteStyle, marginTop: 12, fontStyle: 'normal' }}>
          Referencia completa con ejemplos detallados en{' '}
          <code>TAGS_REF.md</code> (raíz del repositorio).
        </div>
      </div>
    </details>
  )
}
