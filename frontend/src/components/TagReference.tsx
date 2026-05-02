type Props = {
  onAdd: (tag: string) => void
}

type Section = {
  title: string
  tags: string[]
  note?: string
}

const REQUIRED_SECTIONS: Section[] = [
  {
    title: 'service: (always required)',
    tags: [
      'service:liturgy',
      'service:vespers',
      'service:matins',
      'service:compline',
      'service:hours',
      'service:funeral',
      'service:panikhida',
      'service:moleben',
      'service:akathist',
      'service:wedding',
      'service:baptism',
      'service:unction',
      'service:troparion',
      'service:kontakion',
      'service:theotokos-hymn',
    ],
    note: 'Multiple OK — e.g. service:funeral + service:panikhida',
  },
  {
    title: 'language: (always required)',
    tags: [
      'language:english',
      'language:slavonic',
      'language:greek',
      'language:spanish',
      'language:romanian',
      'language:serbian',
    ],
  },
  {
    title: 'voicing: (always required)',
    tags: [
      'voicing:satb',
      'voicing:sab',
      'voicing:ttbb',
      'voicing:ssaa',
      'voicing:unison',
      'voicing:two-part',
    ],
  },
]

const APPLICABLE_SECTIONS: Section[] = [
  {
    title: 'slot: (when piece has a fixed liturgical role)',
    tags: [
      'slot:first-antiphon',
      'slot:second-antiphon',
      'slot:beatitudes',
      'slot:come-let-us-worship',
      'slot:trisagion',
      'slot:cherubic-hymn',
      'slot:hymn-of-victory',
      'slot:we-hymn-thee',
      'slot:theotokos-hymn',
      'slot:our-father',
      'slot:communion-verse',
      'slot:psalm-103',
      'slot:psalm-140',
      'slot:blessed-is-the-man',
      'slot:gladsome-light',
      'slot:canon-ode-1',
      'slot:canon-ode-3',
      'slot:canon-ode-4',
      'slot:canon-ode-5',
      'slot:canon-ode-6',
      'slot:canon-ode-7',
      'slot:canon-ode-8',
      'slot:canon-ode-9',
    ],
  },
  {
    title: 'order: (when slot is set)',
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
    note: '3-digit, multiples of 10 (so you can insert later)',
  },
  {
    title: 'context: (when slot is set)',
    tags: [
      'context:default',
      'context:pascha',
      'context:pentecost',
      'context:lent',
      'context:nativity',
      'context:theophany',
      'context:lazarus-saturday',
      'context:holy-saturday',
      'context:basil-liturgy',
    ],
    note: 'Multiple OK — for pieces used on several feasts',
  },
  {
    title: 'liturgy-type: (when service:liturgy)',
    tags: ['liturgy-type:chrysostom', 'liturgy-type:basil', 'liturgy-type:presanctified'],
  },
  {
    title: 'tone: (when piece has a tone, cyclic or fixed)',
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
    title: 'chant: (specific chant style, when known)',
    tags: [
      'chant:obikhod',
      'chant:kievan',
      'chant:znamenny-lesser',
      'chant:znamenny-greater',
      'chant:optina',
      'chant:valaam',
      'chant:alaska',
      'chant:carpatho-russian',
      'chant:bulgarian',
      'chant:greek',
      'chant:galician',
      'chant:pochaev',
      'chant:byzantine',
      'chant:psaltic',
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
            title={`Add ${t}`}
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
        Tag reference{' '}
        <span style={{ color: 'var(--text)', fontWeight: 'normal' }}>
          (click any tag to add it)
        </span>
      </summary>
      <div style={{ marginTop: 12 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text)', marginBottom: 8 }}>
            Required for every upload:
          </div>
          {REQUIRED_SECTIONS.map((s) => (
            <SectionGroup key={s.title} section={s} onAdd={onAdd} />
          ))}
        </div>
        <div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text)', marginBottom: 8 }}>
            Include when applicable:
          </div>
          {APPLICABLE_SECTIONS.map((s) => (
            <SectionGroup key={s.title} section={s} onAdd={onAdd} />
          ))}
        </div>
        <div style={{ ...noteStyle, marginTop: 12, fontStyle: 'normal' }}>
          Full reference + worked examples in <code>TAGS_REF.md</code> at the repo root.
        </div>
      </div>
    </details>
  )
}
